import crypto from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestDatabase, resetDatabase } from "../../../test/database";
import {
    addFile,
    createCollection,
    createUser,
    encryptedFilePath,
    listFiles,
    readDecryptedFile,
    waitFor
} from "../../../test/fixtures";
import {
    clearRestoreDir,
    corruptEntries,
    createHoldingCopy,
    deleteAllContent,
    editJson,
    makeBackup,
    placeInRestoreFolder,
    releaseHoldingCopies,
    rewriteZip
} from "../../../test/restore-fixtures";
import { pngImage } from "../../../test/upload-fixtures";
import { addVideo } from "../../../test/video-fixtures";
import appConfig from "../common/app-config";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import { UserFileSystem } from "../common/user-file-system";
import { isActiveRestoreJobStatus } from "../types/restore-job-dto";
import { CollectionService } from "./collection.service";
import { RestoreService } from "./restore.service";
import { ThumbnailService } from "./thumbnail.service";
import { VideoProcessingService } from "./video-processing.service";

async function runRestore(service: RestoreService, sourceId: string) {
    const started = await service.start(sourceId);
    return waitFor(
        () => service.getJob(started.id),
        (job) => !isActiveRestoreJobStatus(job.status)
    );
}

/**
 * Everything a Restore brings back of the user's library, in a stable order.
 * Leaves out what a Restore makes again: thumbnail and video processing state.
 */
async function readLibrary(userId: string) {
    const db = await getTestDatabase();
    const collections = await db.models.Collection.findAll({
        where: { UserId: userId },
        include: [
            db.models.Tag,
            { model: db.models.CollectionFile, include: [db.models.Tag] }
        ],
        order: [
            ["id", "ASC"],
            [db.models.CollectionFile, "id", "ASC"]
        ]
    });
    const tagNames = (tags: { name: string }[] | undefined) =>
        (tags ?? []).map((tag) => tag.name).sort();
    return collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
        coverFileId: collection.coverFileId,
        openCount: collection.openCount,
        lastOpened: collection.lastOpened?.toISOString() ?? null,
        tags: tagNames(collection.Tags),
        files: (collection.CollectionFiles ?? []).map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            width: file.width,
            height: file.height,
            thumbnailWidth: file.thumbnailWidth,
            thumbnailHeight: file.thumbnailHeight,
            takenAt: file.takenAt?.toISOString() ?? null,
            durationInSeconds: file.durationInSeconds,
            gpsLatitude: file.gpsLatitude,
            gpsLongitude: file.gpsLongitude,
            gpsAltitude: file.gpsAltitude,
            gpsLabel: file.gpsLabel,
            blurDataUrl: file.blurDataUrl,
            tags: tagNames(file.Tags),
            createdAt: file.createdAt.toISOString(),
            updatedAt: file.updatedAt.toISOString()
        }))
    }));
}

/** Files in the user's storage, leaving out thumbnails the thumbnail worker may have made */
async function listStoredFiles(userId: string) {
    const files = await listFiles(path.join(appConfig.dataDir, userId)).catch(
        () => []
    );
    return files.filter((file) => !file.includes(`${path.sep}tn${path.sep}`));
}

describe("RestoreService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await clearRestoreDir();
    });

    afterEach(() => {
        releaseHoldingCopies();
    });

    it("restores a Backup placed in the user's folder with the same ids and content", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        const beachBytes = crypto.randomBytes(50_000);
        const beach = await addFile(user.id, holiday.id, "beach.jpg", beachBytes);
        const zipPath = await makeBackup(user.id);
        await placeInRestoreFolder("alice", zipPath, "alice.zip");
        await deleteAllContent(user.id);
        const service = new RestoreService(user.id);

        const job = await runRestore(service, "alice.zip");

        expect(job.status).toBe("completed");
        const db = await getTestDatabase();
        const collections = await db.models.Collection.findAll({
            where: { UserId: user.id }
        });
        expect(collections.map((c) => [c.id, c.name])).toEqual([
            [holiday.id, "Holiday"]
        ]);
        const restored = await readDecryptedFile(user.id, holiday.id, beach.id);
        expect(restored.equals(beachBytes)).toBe(true);
    });

    it("restores every collection and file field, tag and timestamp exactly, encrypted at rest with nothing else left on disk", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday", {
            description: "Summer 2023",
            tags: ["summer", "Family"],
            createdAt: new Date("2023-06-01T08:00:00.000Z")
        });
        const empty = await createCollection(user.id, "Empty", {
            createdAt: new Date("2022-01-01T00:00:00.000Z")
        });
        // Several read chunks, so hashing and encryption span chunk boundaries
        const beachBytes = crypto.randomBytes(3 * 1024 * 1024 + 17);
        const beach = await addFile(user.id, holiday.id, "beach.jpg", beachBytes, {
            mimeType: "image/jpeg",
            width: 4000,
            height: 3000,
            thumbnailWidth: 400,
            thumbnailHeight: 300,
            takenAt: new Date("2023-07-01T10:20:30.000Z"),
            createdAt: new Date("2023-07-02T11:00:00.000Z"),
            gpsLatitude: 60.1699,
            gpsLongitude: 24.9384,
            gpsAltitude: 12.5,
            gpsLabel: "Helsinki",
            blurDataUrl: "data:image/png;base64,AAAA",
            tags: ["sea", "Sun"]
        });
        const clipBytes = crypto.randomBytes(3_000);
        const clip = await addFile(user.id, holiday.id, "clip.mp4", clipBytes, {
            mimeType: "video/mp4",
            durationInSeconds: 42
        });
        const emptyFile = await addFile(
            user.id,
            holiday.id,
            "empty.jpg",
            Buffer.alloc(0)
        );
        const before = await readLibrary(user.id);
        const zipPath = await makeBackup(user.id);
        await placeInRestoreFolder("alice", zipPath);
        await deleteAllContent(user.id);

        const job = await runRestore(new RestoreService(user.id), "backup.zip");

        expect(job.status).toBe("completed");
        expect(job.errorMessage).toBeNull();
        expect(await readLibrary(user.id)).toEqual(before);
        expect(before.map(({ id }) => id).sort()).toEqual(
            [holiday.id, empty.id].sort()
        );
        for (const [file, plaintext] of [
            [beach, beachBytes],
            [clip, clipBytes],
            [emptyFile, Buffer.alloc(0)]
        ] as const) {
            const stored = await readFile(
                encryptedFilePath(user.id, holiday.id, file.id)
            );
            expect(stored.length).toBe(plaintext.length + 16);
            if (plaintext.length > 0) {
                expect(stored.includes(plaintext.subarray(0, 64))).toBe(false);
            }
            const decrypted = await readDecryptedFile(user.id, holiday.id, file.id);
            expect(decrypted.equals(plaintext)).toBe(true);
        }
        expect(await listStoredFiles(user.id)).toEqual(
            [beach.id, clip.id, emptyFile.id]
                .map((id) => path.join(holiday.id, id))
                .sort()
        );
    });

    describe("Chosen cover, Open count and Last opened", () => {
        async function createOpenedCollectionWithCover(userId: string) {
            const holiday = await createCollection(userId, "Holiday");
            await addFile(userId, holiday.id, "beach.jpg", crypto.randomBytes(500));
            const clip = await addFile(
                userId,
                holiday.id,
                "clip.mp4",
                crypto.randomBytes(500),
                { mimeType: "video/mp4" }
            );
            await holiday.update({
                coverFileId: clip.id,
                openCount: 7,
                lastOpened: new Date("2024-02-03T04:05:06.789Z")
            });
            return { holiday, clip };
        }

        it("restores them from a version 2 Backup", async () => {
            const user = await createUser("alice");
            const { holiday, clip } = await createOpenedCollectionWithCover(
                user.id
            );
            await placeInRestoreFolder("alice", await makeBackup(user.id));
            await deleteAllContent(user.id);

            const job = await runRestore(new RestoreService(user.id), "backup.zip");

            expect(job.status).toBe("completed");
            const [restored] = await readLibrary(user.id);
            expect(restored).toMatchObject({
                id: holiday.id,
                coverFileId: clip.id,
                openCount: 7,
                lastOpened: "2024-02-03T04:05:06.789Z"
            });
        });

        it("restores none of them from a version 1 Backup, which never recorded them", async () => {
            const user = await createUser("alice");
            const { holiday } = await createOpenedCollectionWithCover(user.id);
            const v2Path = await makeBackup(user.id);
            const v1Path = await rewriteZip(v2Path, `${v2Path}.v1`, (name, data) =>
                name === "manifest.json"
                    ? editJson(data, (manifest) => ({
                          ...manifest,
                          formatVersion: 1
                      }))
                    : name.startsWith("metadata/")
                    ? editJson(
                          data,
                          ({ coverFileId, openCount, lastOpened, ...rest }) => rest
                      )
                    : data
            );
            await placeInRestoreFolder("alice", v1Path);
            await deleteAllContent(user.id);

            const job = await runRestore(new RestoreService(user.id), "backup.zip");

            expect(job.status).toBe("completed");
            const [restored] = await readLibrary(user.id);
            expect(restored).toMatchObject({
                id: holiday.id,
                coverFileId: null,
                openCount: 0,
                lastOpened: null
            });
            expect(restored.files).toHaveLength(2);
        });
    });

    it("shows nothing of the Restore in the account while the job runs, reporting progress, and everything once it completes", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        const pets = await createCollection(user.id, "Pets");
        await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
        await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(2_000));
        await addFile(user.id, pets.id, "cat.jpg", crypto.randomBytes(3_000));
        await placeInRestoreFolder("alice", await makeBackup(user.id));
        await deleteAllContent(user.id);
        const { copyEntry, release, holding } = createHoldingCopy();
        const service = new RestoreService(user.id, { copyEntry });

        const started = await service.start("backup.zip");
        await holding;

        const running = await waitFor(
            () => service.getJob(started.id),
            (job) => job.progress.bytesDone > 0
        );
        expect(running).toMatchObject({
            status: "running",
            sourceId: "backup.zip",
            sourceName: "backup.zip",
            progress: {
                collectionsTotal: 2,
                filesTotal: 3,
                bytesTotal: 6_000,
                currentFileName: expect.any(String)
            }
        });
        expect(await readLibrary(user.id)).toEqual([]);
        const db = await getTestDatabase();
        expect(await db.models.CollectionFile.count()).toBe(0);

        release();
        const job = await waitFor(
            () => service.getJob(started.id),
            (job) => !isActiveRestoreJobStatus(job.status)
        );
        expect(job.status).toBe("completed");
        expect(job.progress).toEqual({
            collectionsDone: 2,
            collectionsTotal: 2,
            filesDone: 3,
            filesTotal: 3,
            bytesDone: 6_000,
            bytesTotal: 6_000,
            currentFileName: null
        });
        const library = await readLibrary(user.id);
        expect(library.map(({ id }) => id).sort()).toEqual(
            [holiday.id, pets.id].sort()
        );
        expect(library.flatMap(({ files }) => files)).toHaveLength(3);
    });

    it("marks restored files pending for thumbnails, which the thumbnail worker then makes, and has video processing pick up restored videos", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const photo = await addFile(user.id, trip.id, "beach.png", await pngImage(), {
            mimeType: "image/png",
            blurDataUrl: "data:image/png;base64,BLUR"
        });
        const video = await addVideo(user.id, trip.id, "clip", {
            videoCodec: "h264",
            audio: "aac",
            container: "mp4"
        });
        await placeInRestoreFolder("alice", await makeBackup(user.id));
        await deleteAllContent(user.id);

        const job = await runRestore(new RestoreService(user.id), "backup.zip");

        expect(job.status).toBe("completed");
        const thumbnails = new ThumbnailService(user.id);
        await waitFor(
            () => thumbnails.getStatus(),
            (status) => status.pending === 0,
            60_000
        );
        expect(await thumbnails.getStatus()).toEqual({ pending: 0, failed: 0 });
        const collections = new CollectionService(user.id);
        for (const file of [photo, video]) {
            const { placeholder } = await collections.getThumbnail(trip.id, file.id);
            expect(placeholder).toBe(false);
        }
        const videoStatus = await waitFor(
            () => new VideoProcessingService(user.id).getStatus(),
            (status) => status.pending === 0 && status.processing === 0,
            60_000
        );
        expect(videoStatus).toMatchObject({ done: 1, failed: 0 });
        const db = await getTestDatabase();
        const restoredVideo = await db.models.CollectionFile.findByPk(video.id);
        expect(restoredVideo?.scrubPreviewLayout).not.toBeNull();
    });

    describe("sources", () => {
        it("offers only the zips in the user's own folder, and their Current backup while its zip exists", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            const holiday = await createCollection(alice.id, "Holiday");
            await addFile(alice.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            const zipPath = await makeBackup(alice.id);
            await placeInRestoreFolder("alice", zipPath, "b-older.zip");
            await placeInRestoreFolder("alice", zipPath, "a-newer.ZIP");
            await placeInRestoreFolder("alice", zipPath, "notes.txt");
            await mkdir(path.join(appConfig.restoreDir, "alice", "nested.zip"));
            await placeInRestoreFolder("bob", zipPath, "bob.zip");
            const service = new RestoreService(alice.id);

            const { sources, hint } = await service.listSources();

            expect(hint).toBeNull();
            const { size } = await stat(zipPath);
            const takenAt = expect.any(Number);
            expect(sources).toEqual([
                {
                    id: "current",
                    kind: "current",
                    fileName: path.basename(zipPath),
                    sizeBytes: size,
                    takenAt
                },
                { id: "a-newer.ZIP", kind: "placed", fileName: "a-newer.ZIP", sizeBytes: size, takenAt },
                { id: "b-older.zip", kind: "placed", fileName: "b-older.zip", sizeBytes: size, takenAt }
            ]);
            await expect(service.inspect("bob.zip")).rejects.toThrow(NotFoundError);
            await expect(service.start("bob.zip")).rejects.toThrow(NotFoundError);
            await expect(service.start("../bob/bob.zip")).rejects.toThrow(
                NotFoundError
            );
            expect((await new RestoreService(bob.id).listSources()).sources.map(
                ({ id }) => id
            )).toEqual(["bob.zip"]);

            await unlink(zipPath);
            expect(
                (await service.listSources()).sources.map(({ id }) => id)
            ).toEqual(["a-newer.ZIP", "b-older.zip"]);
        });

        it("says why Restore is unavailable while the account has collections", async () => {
            const user = await createUser("alice");
            const service = new RestoreService(user.id);
            expect((await service.listSources()).unavailableReason).toBeNull();

            await createCollection(user.id, "Holiday");

            expect((await service.listSources()).unavailableReason).toMatch(
                /only possible into an account with no collections/
            );
        });

        it("gives an empty list with a hint when the user's folder does not exist", async () => {
            const user = await createUser("alice");

            const { sources, folder, hint } = await new RestoreService(
                user.id
            ).listSources();

            expect(sources).toEqual([]);
            expect(folder).toBe(path.join(appConfig.restoreDir, "alice"));
            expect(hint).toContain(folder);
        });

        it("restores from the Current backup", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            const before = await readLibrary(user.id);
            const zipPath = await makeBackup(user.id);
            const zipBytes = await readFile(zipPath);
            await deleteAllContent(user.id);

            const job = await runRestore(new RestoreService(user.id), "current");

            expect(job).toMatchObject({
                status: "completed",
                sourceId: "current",
                sourceName: path.basename(zipPath)
            });
            expect(await readLibrary(user.id)).toEqual(before);
            expect((await readFile(zipPath)).equals(zipBytes)).toBe(true);
        });

        it("summarises a source from its Manifest", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            await createCollection(user.id, "Empty");
            await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(2_000));
            const missing = await addFile(
                user.id,
                holiday.id,
                "missing.jpg",
                crypto.randomBytes(500)
            );
            await unlink(encryptedFilePath(user.id, holiday.id, missing.id));
            const zipPath = await placeInRestoreFolder(
                "alice",
                await makeBackup(user.id)
            );
            await deleteAllContent(user.id);

            const inspection = await new RestoreService(user.id).inspect(
                "backup.zip"
            );

            expect(inspection).toEqual({
                source: expect.objectContaining({ id: "backup.zip" }),
                summary: {
                    username: "alice",
                    takenAt: expect.any(Number),
                    formatVersion: 2,
                    collectionCount: 2,
                    fileCount: 2,
                    bytes: 3_000,
                    zipSizeBytes: (await stat(zipPath)).size,
                    problems: [
                        expect.objectContaining({
                            fileId: missing.id,
                            name: "missing.jpg",
                            kind: "skipped"
                        })
                    ]
                },
                reason: null
            });
        });
    });

    describe("refusals before a job is created", () => {
        /** Expects the start to be refused with the reason, which inspecting gives too, and no job to exist */
        async function expectRefused(
            service: RestoreService,
            sourceId: string,
            reason: RegExp
        ) {
            await expect(service.start(sourceId)).rejects.toThrow(
                InvalidArgumentError
            );
            await expect(service.start(sourceId)).rejects.toThrow(reason);
            const db = await getTestDatabase();
            expect(await db.models.RestoreJob.count()).toBe(0);
        }

        async function placeBackupOfNewUser(
            username: string,
            edit?: (name: string, data: Buffer) => Buffer | null
        ) {
            const user = await createUser(username);
            const holiday = await createCollection(user.id, "Holiday");
            await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            let zipPath = await makeBackup(user.id);
            if (edit) {
                zipPath = await rewriteZip(zipPath, `${zipPath}.edited`, edit);
            }
            await placeInRestoreFolder(username, zipPath);
            await deleteAllContent(user.id);
            return user;
        }

        it("refuses when the account has collections", async () => {
            const user = await placeBackupOfNewUser("alice");
            await createCollection(user.id, "New");
            const service = new RestoreService(user.id);

            await expectRefused(service, "backup.zip", /no collections/);
            expect((await service.inspect("backup.zip")).reason).toMatch(
                /no collections/
            );
        });

        it("refuses when the Backup's collections or files still exist on the instance, in any account", async () => {
            const alice = await createUser("alice");
            const holiday = await createCollection(alice.id, "Holiday");
            await addFile(alice.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            const zipPath = await makeBackup(alice.id);
            const bob = await createUser("bob");
            await placeInRestoreFolder("bob", zipPath);

            await expectRefused(
                new RestoreService(bob.id),
                "backup.zip",
                /still on this Holvi instance/
            );
        });

        it("refuses when the data volume lacks free space for the files and their thumbnails", async () => {
            const user = await placeBackupOfNewUser("alice");
            const checkedDirs: string[] = [];
            const service = new RestoreService(user.id, {
                getFreeSpace: async (dir) => {
                    checkedDirs.push(dir);
                    return 1_000;
                }
            });

            await expectRefused(service, "backup.zip", /Not enough free space/);
            expect(checkedDirs).toContain(appConfig.dataDir);
        });

        it("refuses a Backup of a newer format, asking to update Holvi first", async () => {
            const user = await placeBackupOfNewUser("alice", (name, data) =>
                name === "manifest.json"
                    ? editJson(data, (manifest) => ({ ...manifest, formatVersion: 3 }))
                    : data
            );

            await expectRefused(
                new RestoreService(user.id),
                "backup.zip",
                /newer version of Holvi.*Update Holvi first/
            );
        });

        it("refuses a file that is not a zip, a zip with no Manifest, and a Backup with unreadable metadata", async () => {
            const user = await createUser("alice");
            const folder = path.join(appConfig.restoreDir, "alice");
            await mkdir(folder, { recursive: true });
            await writeFile(path.join(folder, "random.zip"), crypto.randomBytes(5_000));
            const holiday = await createCollection(user.id, "Holiday");
            await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            const zipPath = await makeBackup(user.id);
            await rewriteZip(zipPath, path.join(folder, "no-manifest.zip"), (name, data) =>
                name === "manifest.json" ? null : data
            );
            await rewriteZip(zipPath, path.join(folder, "bad-metadata.zip"), (name, data) =>
                name.startsWith("metadata/") ? Buffer.from("{ not json") : data
            );
            await deleteAllContent(user.id);
            const service = new RestoreService(user.id);

            await expectRefused(service, "random.zip", /Not a Holvi Backup/);
            await expectRefused(service, "no-manifest.zip", /no Manifest/);
            await expectRefused(service, "bad-metadata.zip", /metadata\/Holiday\.json/);
        });

        it("refuses while the user's Backup job is queued or running", async () => {
            const user = await placeBackupOfNewUser("alice");
            const db = await getTestDatabase();
            await db.models.BackupJob.create({
                UserId: user.id,
                status: "running",
                queuedAt: new Date()
            });

            await expectRefused(
                new RestoreService(user.id),
                "backup.zip",
                /Backup job is queued or running/
            );
        });

        it("refuses while the user already has a queued or running Restore job", async () => {
            const user = await placeBackupOfNewUser("alice");
            const { copyEntry, release, holding } = createHoldingCopy();
            const service = new RestoreService(user.id, { copyEntry });
            const first = await service.start("backup.zip");
            await holding;

            await expect(service.start("backup.zip")).rejects.toThrow(
                /already have a Restore job/
            );
            expect((await service.getJobs()).map(({ id }) => id)).toEqual([first.id]);

            release();
            await waitFor(
                () => service.getJob(first.id),
                (job) => !isActiveRestoreJobStatus(job.status)
            );
        });
    });

    it("on server start, fails a job left running by a previous process, deletes the files it wrote and runs queued jobs", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const bobs = await createCollection(bob.id, "Bob's");
        await addFile(bob.id, bobs.id, "b.jpg", crypto.randomBytes(1_000));
        const bobZip = await placeInRestoreFolder("bob", await makeBackup(bob.id));
        await deleteAllContent(bob.id);
        const db = await getTestDatabase();
        const leftCollectionId = crypto.randomUUID();
        const leftDir = path.join(appConfig.dataDir, alice.id, leftCollectionId);
        await mkdir(leftDir, { recursive: true });
        await writeFile(path.join(leftDir, `${crypto.randomUUID()}.partial`), "x");
        await writeFile(path.join(leftDir, crypto.randomUUID()), "x");
        const zipStats = await stat(bobZip);
        const interrupted = await db.models.RestoreJob.create({
            UserId: alice.id,
            status: "running",
            queuedAt: new Date(Date.now() - 60_000),
            sourceId: "alice.zip",
            sourceName: "alice.zip",
            zipPath: path.join(appConfig.restoreDir, "alice", "alice.zip"),
            zipSizeBytes: 1,
            zipModifiedAt: new Date(),
            collectionIds: [leftCollectionId]
        });
        const queued = await db.models.RestoreJob.create({
            UserId: bob.id,
            status: "queued",
            queuedAt: new Date(),
            sourceId: "backup.zip",
            sourceName: "backup.zip",
            zipPath: bobZip,
            zipSizeBytes: zipStats.size,
            zipModifiedAt: zipStats.mtime,
            collectionIds: [bobs.id]
        });

        await RestoreService.recover();

        expect(await new RestoreService(alice.id).getJob(interrupted.id)).toMatchObject({
            status: "failed",
            errorMessage: expect.stringContaining("restarted")
        });
        expect(await listStoredFiles(alice.id)).toEqual([]);
        const bobsJob = await waitFor(
            () => new RestoreService(bob.id).getJob(queued.id),
            (job) => !isActiveRestoreJobStatus(job.status)
        );
        expect(bobsJob.status).toBe("completed");
        expect((await readLibrary(bob.id)).map(({ id }) => id)).toEqual([bobs.id]);
    });

    it("fails the job and leaves nothing behind when its zip changed after it was queued", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
        await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(1_000));
        const zipPath = await placeInRestoreFolder("alice", await makeBackup(user.id));
        await deleteAllContent(user.id);
        const { copyEntry, release, holding } = createHoldingCopy();
        const blocker = await createUser("blocker");
        const blockers = await createCollection(blocker.id, "Blocker");
        await addFile(blocker.id, blockers.id, "x.jpg", crypto.randomBytes(1_000));
        await placeInRestoreFolder("blocker", await makeBackup(blocker.id));
        await deleteAllContent(blocker.id);
        // Holds the instance's one Restore job lane, so alice's job stays queued
        const blocking = await new RestoreService(blocker.id, { copyEntry }).start(
            "backup.zip"
        );
        await holding;
        const service = new RestoreService(user.id);
        const queued = await service.start("backup.zip");
        await writeFile(zipPath, crypto.randomBytes(10));

        release();
        const job = await waitFor(
            () => service.getJob(queued.id),
            (job) => !isActiveRestoreJobStatus(job.status)
        );

        expect(job.status).toBe("failed");
        expect(job.errorMessage).toMatch(/changed or disappeared/);
        expect(await readLibrary(user.id)).toEqual([]);
        expect(await listStoredFiles(user.id)).toEqual([]);
        await waitFor(
            () => new RestoreService(blocker.id).getJob(blocking.id),
            (job) => !isActiveRestoreJobStatus(job.status)
        );
    });

    it("fails the job and deletes every file it wrote when reading the zip fails partway", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
        const failing = await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(1_000));
        await placeInRestoreFolder("alice", await makeBackup(user.id));
        await deleteAllContent(user.id);
        const service = new RestoreService(user.id, {
            copyEntry: (entry, content) =>
                entry.fileId === failing.id
                    ? Readable.from(
                          (async function* () {
                              yield* content;
                              throw new Error("EIO: i/o error, read");
                          })()
                      )
                    : content
        });

        const job = await runRestore(service, "backup.zip");

        expect(job).toMatchObject({ status: "failed", errorMessage: "EIO: i/o error, read" });
        expect(await readLibrary(user.id)).toEqual([]);
        expect(await listStoredFiles(user.id)).toEqual([]);
    });

    describe("files that do not come back", () => {
        it("leaves out a file whose content does not match its checksum as an Unrestored file and completes with errors", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const aBytes = crypto.randomBytes(1_000);
            const a = await addFile(user.id, holiday.id, "a.jpg", aBytes);
            const bad = await addFile(
                user.id,
                holiday.id,
                "bad.jpg",
                crypto.randomBytes(2_000),
                { tags: ["only-on-bad"] }
            );
            await placeInRestoreFolder("alice", await makeBackup(user.id));
            await deleteAllContent(user.id);
            const service = new RestoreService(user.id, {
                copyEntry: corruptEntries([bad.id])
            });

            const job = await runRestore(service, "backup.zip");

            expect(job.status).toBe("completedWithErrors");
            expect(job.unrestoredFiles).toEqual([
                {
                    fileId: bad.id,
                    collectionId: holiday.id,
                    name: "bad.jpg",
                    reason: expect.stringContaining("checksum")
                }
            ]);
            const [restored] = await readLibrary(user.id);
            expect(restored.files.map(({ id }) => id)).toEqual([a.id]);
            expect(
                (await readDecryptedFile(user.id, holiday.id, a.id)).equals(aBytes)
            ).toBe(true);
            expect(await listStoredFiles(user.id)).toEqual([
                path.join(holiday.id, a.id)
            ]);
            const db = await getTestDatabase();
            expect(
                await db.models.CollectionFileTag.count({
                    where: { CollectionFileId: bad.id }
                })
            ).toBe(0);
        });

        it("leaves out the Backup's Skipped and Damaged files and carries over its Problem files", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const kept = await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
            const skipped = await addFile(
                user.id,
                holiday.id,
                "skipped.jpg",
                crypto.randomBytes(1_000)
            );
            const damaged = await addFile(
                user.id,
                holiday.id,
                "damaged.jpg",
                crypto.randomBytes(5_000)
            );
            await unlink(encryptedFilePath(user.id, holiday.id, skipped.id));
            const zipPath = await makeBackup(user.id, {
                openDecryptedFile: (ref) => {
                    const real = new UserFileSystem(ref.userId).openDecryptedFile(
                        ref.collectionId,
                        ref.fileId
                    );
                    if (ref.fileId !== damaged.id) {
                        return real;
                    }
                    return Readable.from(
                        (async function* () {
                            for await (const chunk of real) {
                                yield chunk.subarray(0, 1_000);
                                break;
                            }
                            throw new Error("EIO: i/o error, read");
                        })()
                    );
                }
            });
            await placeInRestoreFolder("alice", zipPath);
            await deleteAllContent(user.id);

            const job = await runRestore(new RestoreService(user.id), "backup.zip");

            expect(job.status).toBe("completed");
            expect(job.unrestoredFiles).toEqual([]);
            expect(job.problems).toHaveLength(2);
            expect(job.problems).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ fileId: damaged.id, kind: "damaged" }),
                    expect.objectContaining({ fileId: skipped.id, kind: "skipped" })
                ])
            );
            const [restored] = await readLibrary(user.id);
            expect(restored.files.map(({ id }) => id)).toEqual([kept.id]);
            expect(await listStoredFiles(user.id)).toEqual([
                path.join(holiday.id, kept.id)
            ]);
        });

        it("falls back to the Rotating cover when the Chosen cover did not come back, and restores a collection with no files that came back empty", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday", {
                description: "Summer",
                tags: ["summer"]
            });
            const cover = await addFile(
                user.id,
                holiday.id,
                "cover.jpg",
                crypto.randomBytes(1_000)
            );
            await addFile(user.id, holiday.id, "other.jpg", crypto.randomBytes(1_000));
            await holiday.update({ coverFileId: cover.id });
            const pets = await createCollection(user.id, "Pets", {
                tags: ["animals"]
            });
            const cat = await addFile(user.id, pets.id, "cat.jpg", crypto.randomBytes(1_000));
            const empty = await createCollection(user.id, "Empty");
            await placeInRestoreFolder("alice", await makeBackup(user.id));
            await deleteAllContent(user.id);
            const service = new RestoreService(user.id, {
                copyEntry: corruptEntries([cover.id, cat.id])
            });

            const job = await runRestore(service, "backup.zip");

            expect(job.status).toBe("completedWithErrors");
            const library = await readLibrary(user.id);
            const byId = (id: string) => library.find((c) => c.id === id)!;
            expect(byId(holiday.id).coverFileId).toBeNull();
            expect(byId(holiday.id).files).toHaveLength(1);
            expect(byId(pets.id)).toMatchObject({
                name: "Pets",
                tags: ["animals"],
                files: []
            });
            expect(byId(empty.id)).toMatchObject({ name: "Empty", files: [] });
        });
    });
});

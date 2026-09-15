import crypto from "crypto";
import { Readable } from "stream";
import { beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    addThumbnail,
    createCollection,
    createHoldingOpener,
    createUser,
    hasZip64EndOfCentralDirectory,
    listFiles,
    listUserBackupDir,
    readZip,
    setCollectionTags,
    setFileTags,
    TEST_PASSWORD_HASH,
    TEST_PASSWORD_SALT,
    waitFor
} from "../../../test/backup-fixtures";
import { getTestDatabase, resetDatabase } from "../../../test/database";
import appConfig from "../common/app-config";
import { NotFoundError } from "../common/errors";
import { isActiveBackupJobStatus } from "../types/backup-job-dto";
import { BackupService } from "./backup.service";

function sha256(data: Buffer) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

async function runBackup(service: BackupService) {
    const started = await service.start();
    return waitFor(
        () => service.getJob(started.id),
        (job) => !isActiveBackupJobStatus(job.status)
    );
}

describe("BackupService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("produces a zip with every file's decrypted bytes under files/<collection>/<file name>", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        const pets = await createCollection(user.id, "Pets");
        const beach = crypto.randomBytes(100_000);
        const sunset = crypto.randomBytes(12_345);
        const cat = crypto.randomBytes(1);
        await addFile(user.id, holiday.id, "beach.jpg", beach);
        await addFile(user.id, holiday.id, "sunset.mp4", sunset, {
            mimeType: "video/mp4"
        });
        await addFile(user.id, pets.id, "cat.png", cat, { mimeType: "image/png" });
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        expect(job.status).toBe("completed");
        const download = await service.openDownload(job.id);
        const entries = await readZip(download.filePath);
        const files = Object.fromEntries(
            entries
                .filter((entry) => entry.name.startsWith("files/"))
                .map((entry) => [entry.name, entry.data])
        );
        expect(Object.keys(files).sort()).toEqual([
            "files/Holiday/beach.jpg",
            "files/Holiday/sunset.mp4",
            "files/Pets/cat.png"
        ]);
        expect(files["files/Holiday/beach.jpg"].equals(beach)).toBe(true);
        expect(files["files/Holiday/sunset.mp4"].equals(sunset)).toBe(true);
        expect(files["files/Pets/cat.png"].equals(cat)).toBe(true);
    });

    it("writes the manifest as the final entry, stores files uncompressed and uses ZIP64", async () => {
        const user = await createUser("alice", { requireSignIn: true });
        const empty = await createCollection(user.id, "Empty");
        const holiday = await createCollection(user.id, "Holiday");
        const pets = await createCollection(user.id, "Pets");
        await addFile(user.id, holiday.id, "beach.jpg", crypto.randomBytes(5_000));
        await addFile(user.id, holiday.id, "sea.jpg", crypto.randomBytes(1_000));
        await addFile(user.id, pets.id, "cat.png", crypto.randomBytes(2_500));
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        const { filePath } = await service.openDownload(job.id);
        const entries = await readZip(filePath);
        const last = entries.at(-1)!;
        expect(last.name).toBe("manifest.json");
        const manifest = JSON.parse(last.data.toString("utf8"));
        const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(manifest).toEqual({
            formatVersion: 1,
            schemaVersion: 4,
            snapshotAt: expect.stringMatching(isoUtc),
            startedAt: new Date(job.startedAt!).toISOString(),
            finishedAt: new Date(job.finishedAt!).toISOString(),
            outcome: "completed",
            user: { id: user.id, username: "alice", requireSignIn: true },
            collections: [
                {
                    id: empty.id,
                    name: "Empty",
                    folder: "Empty",
                    metadataPath: "metadata/Empty.json",
                    fileCount: 0
                },
                {
                    id: holiday.id,
                    name: "Holiday",
                    folder: "Holiday",
                    metadataPath: "metadata/Holiday.json",
                    fileCount: 2
                },
                {
                    id: pets.id,
                    name: "Pets",
                    folder: "Pets",
                    metadataPath: "metadata/Pets.json",
                    fileCount: 1
                }
            ],
            totals: { files: 3, bytes: 8_500 }
        });
        expect(Date.parse(manifest.snapshotAt)).toBeLessThanOrEqual(
            Date.parse(manifest.startedAt)
        );
        expect(
            entries.some((entry) => entry.name === manifest.collections[1].metadataPath)
        ).toBe(true);
        const STORE = 0;
        const DEFLATE = 8;
        for (const entry of entries) {
            expect(entry.compressionMethod).toBe(
                entry.name.endsWith(".json") ? DEFLATE : STORE
            );
        }
        expect(await hasZip64EndOfCentralDirectory(filePath)).toBe(true);
    });

    it("writes a metadata document per collection with every collection and file field", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday", {
            description: "Summer 2023",
            tags: ["summer", "family"]
        });
        const empty = await createCollection(user.id, "Empty");
        const beach = await addFile(
            user.id,
            holiday.id,
            "beach.jpg",
            crypto.randomBytes(2_000),
            {
                mimeType: "image/jpeg",
                width: 4000,
                height: 3000,
                thumbnailWidth: 400,
                thumbnailHeight: 300,
                takenAt: new Date("2023-07-01T10:20:30.000Z"),
                gpsLatitude: 60.1699,
                gpsLongitude: 24.9384,
                gpsAltitude: 12.5,
                gpsLabel: "Helsinki",
                blurDataUrl: "data:image/png;base64,AAAA",
                tags: ["sea", "sun"]
            }
        );
        const clip = await addFile(
            user.id,
            holiday.id,
            "clip.mp4",
            crypto.randomBytes(3_000),
            { mimeType: "video/mp4", durationInSeconds: 42 }
        );
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        const entries = await readZip((await service.openDownload(job.id)).filePath);
        const names = entries.map((entry) => entry.name);
        const metadata = (name: string) =>
            JSON.parse(
                entries.find((entry) => entry.name === name)!.data.toString("utf8")
            );
        expect(metadata("metadata/Holiday.json")).toEqual({
            id: holiday.id,
            name: "Holiday",
            description: "Summer 2023",
            createdAt: holiday.createdAt.toISOString(),
            updatedAt: holiday.updatedAt.toISOString(),
            tags: ["family", "summer"],
            files: [
                {
                    id: beach.id,
                    name: "beach.jpg",
                    backupPath: "files/Holiday/beach.jpg",
                    status: "included",
                    mimeType: "image/jpeg",
                    sizeBytes: 2_000,
                    sha256: expect.any(String),
                    width: 4000,
                    height: 3000,
                    thumbnailWidth: 400,
                    thumbnailHeight: 300,
                    takenAt: "2023-07-01T10:20:30.000Z",
                    durationInSeconds: null,
                    gpsLatitude: 60.1699,
                    gpsLongitude: 24.9384,
                    gpsAltitude: 12.5,
                    gpsLabel: "Helsinki",
                    blurDataUrl: "data:image/png;base64,AAAA",
                    tags: ["sea", "sun"],
                    createdAt: beach.createdAt.toISOString(),
                    updatedAt: beach.updatedAt.toISOString()
                },
                {
                    id: clip.id,
                    name: "clip.mp4",
                    backupPath: "files/Holiday/clip.mp4",
                    status: "included",
                    mimeType: "video/mp4",
                    sizeBytes: 3_000,
                    sha256: expect.any(String),
                    width: null,
                    height: null,
                    thumbnailWidth: null,
                    thumbnailHeight: null,
                    takenAt: null,
                    durationInSeconds: 42,
                    gpsLatitude: null,
                    gpsLongitude: null,
                    gpsAltitude: null,
                    gpsLabel: null,
                    blurDataUrl: null,
                    tags: [],
                    createdAt: clip.createdAt.toISOString(),
                    updatedAt: clip.updatedAt.toISOString()
                }
            ]
        });
        expect(metadata("metadata/Empty.json")).toEqual({
            id: empty.id,
            name: "Empty",
            description: null,
            createdAt: empty.createdAt.toISOString(),
            updatedAt: empty.updatedAt.toISOString(),
            tags: [],
            files: []
        });
        // Each collection's metadata follows that collection's files
        expect(names.indexOf("metadata/Holiday.json")).toBeGreaterThan(
            names.indexOf("files/Holiday/clip.mp4")
        );
    });

    it("records each included file's SHA-256, matching its original plaintext and its zip entry", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        // Several decryption chunks, so the hash spans chunk boundaries
        const big = crypto.randomBytes(3 * 1024 * 1024 + 17);
        const empty = Buffer.alloc(0);
        await addFile(user.id, holiday.id, "big.mp4", big);
        await addFile(user.id, holiday.id, "empty.jpg", empty);
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        const entries = await readZip((await service.openDownload(job.id)).filePath);
        const entry = (name: string) =>
            entries.find((candidate) => candidate.name === name)!;
        const { files } = JSON.parse(
            entry("metadata/Holiday.json").data.toString("utf8")
        );
        // Known SHA-256 of zero bytes
        expect(files.map((file: { sha256: string }) => file.sha256)).toEqual([
            sha256(big),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        ]);
        expect(sha256(entry("files/Holiday/big.mp4").data)).toBe(files[0].sha256);
        expect(sha256(entry("files/Holiday/empty.jpg").data)).toBe(
            files[1].sha256
        );
    });

    it("leaves out credentials, thumbnails and tags not attached to the user's content", async () => {
        const user = await createUser("alice");
        const bob = await createUser("bob");
        const holiday = await createCollection(user.id, "Holiday", {
            tags: ["summer"]
        });
        const beach = await addFile(
            user.id,
            holiday.id,
            "beach.jpg",
            crypto.randomBytes(2_000),
            { tags: ["sea"] }
        );
        const thumbnail = crypto.randomBytes(1_500);
        await addThumbnail(user.id, holiday.id, beach.id, thumbnail);
        await createCollection(bob.id, "Bob's", { tags: ["bobs-secret-tag"] });
        const db = await getTestDatabase();
        await db.models.Tag.create({ name: "unattached-tag" });
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        const entries = await readZip((await service.openDownload(job.id)).filePath);
        expect(entries.map((entry) => entry.name).sort()).toEqual([
            "files/Holiday/beach.jpg",
            "manifest.json",
            "metadata/Holiday.json"
        ]);
        for (const entry of entries) {
            expect(entry.data.includes(TEST_PASSWORD_HASH)).toBe(false);
            expect(entry.data.includes(TEST_PASSWORD_SALT)).toBe(false);
            expect(entry.data.includes("bobs-secret-tag")).toBe(false);
            expect(entry.data.includes("unattached-tag")).toBe(false);
            expect(entry.data.includes(thumbnail)).toBe(false);
        }
    });

    it("records metadata as it was when the job started, even if files are renamed or retagged during the run", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday", {
            description: "Before",
            tags: ["before"]
        });
        const a = await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(200_000), {
            tags: ["before"]
        });
        const b = await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(50_000));
        const opener = createHoldingOpener();
        const service = new BackupService(user.id, {
            openDecryptedFile: opener.openDecryptedFile
        });

        const started = await service.start();
        await waitFor(
            () => service.getJob(started.id),
            (job) => job.progress.bytesDone > 0
        );
        const db = await getTestDatabase();
        await db.models.CollectionFile.update(
            { name: "renamed.jpg" },
            { where: { id: b.id } }
        );
        await db.models.Collection.update(
            { name: "Renamed", description: "After" },
            { where: { id: holiday.id } }
        );
        await setFileTags(a.id, ["after"]);
        await setCollectionTags(holiday.id, ["after"]);
        opener.release();
        const job = await waitFor(
            () => service.getJob(started.id),
            (current) => !isActiveBackupJobStatus(current.status)
        );

        expect(job.status).toBe("completed");
        const entries = await readZip((await service.openDownload(job.id)).filePath);
        expect(entries.map((entry) => entry.name)).toEqual([
            "files/Holiday/a.jpg",
            "files/Holiday/b.jpg",
            "metadata/Holiday.json",
            "manifest.json"
        ]);
        const metadata = JSON.parse(entries[2].data.toString("utf8"));
        expect(metadata).toMatchObject({
            name: "Holiday",
            description: "Before",
            tags: ["before"],
            files: [
                { id: a.id, name: "a.jpg", tags: ["before"] },
                { id: b.id, name: "b.jpg", tags: [] }
            ]
        });
    });

    it("runs in the background, persisting progress and keeping only a .zip.partial until it completes", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
        await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(50_000));
        const dataDirBefore = await listFiles(appConfig.dataDir);
        const opener = createHoldingOpener();
        const service = new BackupService(user.id, {
            openDecryptedFile: opener.openDecryptedFile
        });

        const started = await service.start();

        expect(["queued", "running"]).toContain(started.status);
        // A fresh service reads only what was persisted, like a page reload would
        const running = await waitFor(
            () => new BackupService(user.id).getJob(started.id),
            (job) => job.progress.bytesDone > 0
        );
        expect(running.status).toBe("running");
        expect(running.progress).toMatchObject({
            collectionsDone: 0,
            collectionsTotal: 1,
            filesDone: 0,
            filesTotal: 2,
            bytesTotal: 250_000,
            currentFileName: "a.jpg"
        });
        expect(await listUserBackupDir(user.id)).toEqual([
            expect.stringMatching(/^holvi-backup-alice-.+\.zip\.partial$/)
        ]);
        expect(await listFiles(appConfig.dataDir)).toEqual(dataDirBefore);

        opener.release();
        const finished = await waitFor(
            () => service.getJob(started.id),
            (job) => !isActiveBackupJobStatus(job.status)
        );

        expect(finished.status).toBe("completed");
        expect(finished.progress).toMatchObject({
            collectionsDone: 1,
            filesDone: 2,
            bytesDone: 250_000
        });
        expect(finished.zipFileName).toMatch(/^holvi-backup-alice-.+\.zip$/);
        expect(await listUserBackupDir(user.id)).toEqual([
            finished.zipFileName
        ]);
        expect(await listFiles(appConfig.dataDir)).toEqual(dataDirBefore);
    });

    it("fails the job and removes the partial zip when the disk runs out of space", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
        await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(1_000));
        const service = new BackupService(user.id, {
            openDecryptedFile: () =>
                new Readable({
                    read() {
                        this.push(crypto.randomBytes(500));
                        this.destroy(
                            Object.assign(
                                new Error("ENOSPC: no space left on device"),
                                { code: "ENOSPC" }
                            )
                        );
                    }
                })
        });

        const job = await runBackup(service);

        expect(job.status).toBe("failed");
        expect(job.errorMessage).toMatch(/no space left/);
        expect(job.zipFileName).toBeNull();
        expect(await listUserBackupDir(user.id)).toEqual([]);
        await expect(service.openDownload(job.id)).rejects.toThrow(
            NotFoundError
        );
    });

    it("lists a user's jobs latest first and hides them from other users", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const holiday = await createCollection(alice.id, "Holiday");
        await addFile(alice.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
        const aliceService = new BackupService(alice.id);
        const bobService = new BackupService(bob.id);

        const first = await runBackup(aliceService);
        const second = await runBackup(aliceService);

        expect((await aliceService.getJobs()).map((job) => job.id)).toEqual([
            second.id,
            first.id
        ]);
        expect(await bobService.getJobs()).toEqual([]);
        await expect(bobService.getJob(first.id)).rejects.toThrow(
            NotFoundError
        );
        await expect(bobService.openDownload(first.id)).rejects.toThrow(
            NotFoundError
        );
        await expect(aliceService.getJob("not-a-uuid")).rejects.toThrow(
            NotFoundError
        );
    });
});

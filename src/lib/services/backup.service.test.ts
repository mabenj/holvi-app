import crypto from "crypto";
import { createWriteStream, existsSync } from "fs";
import { appendFile, mkdir, truncate, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    addThumbnail,
    createCollection,
    createHoldingOpener,
    createUser,
    encryptedFilePath,
    extractZip,
    hasZip64EndOfCentralDirectory,
    listFiles,
    listUserBackupDir,
    readZip,
    releaseHoldingOpeners,
    setCollectionTags,
    setFileTags,
    TEST_PASSWORD_HASH,
    TEST_PASSWORD_SALT,
    waitFor
} from "../../../test/backup-fixtures";
import { getTestDatabase, resetDatabase } from "../../../test/database";
import appConfig from "../common/app-config";
import { NotFoundError } from "../common/errors";
import { UserFileSystem } from "../common/user-file-system";
import { isActiveBackupJobStatus } from "../types/backup-job-dto";
import { BackupFileRef, BackupService } from "./backup.service";

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

    afterEach(() => {
        releaseHoldingOpeners();
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
            schemaVersion: 5,
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
            totals: { files: 3, bytes: 8_500 },
            problems: []
        });
        expect(job).toMatchObject({
            status: "completed",
            skippedCount: 0,
            damagedCount: 0,
            problems: []
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

    describe("whole-job failures", () => {
        /** A user with two files and a completed backup, which no failure may touch */
        async function createUserWithBackup() {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const a = await addFile(
                user.id,
                holiday.id,
                "a.jpg",
                crypto.randomBytes(100_000)
            );
            const b = await addFile(
                user.id,
                holiday.id,
                "b.jpg",
                crypto.randomBytes(50_000)
            );
            const previous = await runBackup(new BackupService(user.id));
            expect(previous.status).toBe("completed");
            return { user, files: [a, b], previous };
        }

        async function expectOnlyPreviousBackup(
            service: BackupService,
            userId: string,
            previous: { id: string; zipFileName: string | null }
        ) {
            expect(await listUserBackupDir(userId)).toEqual([previous.zipFileName]);
            const { filePath } = await service.openDownload(previous.id);
            expect((await readZip(filePath)).at(-1)!.name).toBe("manifest.json");
        }

        function openRealDecryptedFile(ref: BackupFileRef) {
            return new UserFileSystem(ref.userId).openDecryptedFile(
                ref.collectionId,
                ref.fileId
            );
        }

        it("fails the job before writing anything when the backup directory lacks free space, stating space needed vs available", async () => {
            const { user, previous } = await createUserWithBackup();
            const openedFiles: BackupFileRef[] = [];
            const checkedDirs: string[] = [];
            const service = new BackupService(user.id, {
                openDecryptedFile: (ref) => {
                    openedFiles.push(ref);
                    return openRealDecryptedFile(ref);
                },
                getFreeSpace: async (dir) => {
                    checkedDirs.push(dir);
                    return 5_000;
                }
            });

            const job = await runBackup(service);

            expect(job.status).toBe("failed");
            expect(job.errorMessage).toMatch(/not enough free space/i);
            expect(job.errorMessage).toMatch(/[\d.]+ [KMGT]?B needed/);
            expect(job.errorMessage).toContain("4.9 KB available");
            expect(job.zipFileName).toBeNull();
            expect(checkedDirs).toEqual([appConfig.backupDir]);
            expect(openedFiles).toEqual([]);
            await expectOnlyPreviousBackup(service, user.id, previous);
            await expect(service.openDownload(job.id)).rejects.toThrow(NotFoundError);
        });

        it("runs normally when the backup directory has enough free space", async () => {
            const { user } = await createUserWithBackup();
            const checkedDirs: string[] = [];
            const service = new BackupService(user.id, {
                getFreeSpace: async (dir) => {
                    checkedDirs.push(dir);
                    return 1_000_000_000_000;
                }
            });

            const job = await runBackup(service);

            expect(job.status).toBe("completed");
            expect(checkedDirs).toEqual([appConfig.backupDir]);
            expect(await listUserBackupDir(user.id)).toContain(job.zipFileName);
        });

        it("fails the job, removes the partial zip and keeps the previous backup when the disk runs out of space", async () => {
            const { user, previous } = await createUserWithBackup();
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
            await expectOnlyPreviousBackup(service, user.id, previous);
            await expect(service.openDownload(job.id)).rejects.toThrow(NotFoundError);
        });

        it("fails the job, removes the partial zip and keeps the previous backup when the zip cannot be written", async () => {
            const { user, previous } = await createUserWithBackup();
            let partialZipExistedOnFailure = false;
            const service = new BackupService(user.id, {
                openZipOutput: (partialZipPath) => {
                    const output = createWriteStream(partialZipPath, { flags: "wx" });
                    const writeError = Object.assign(new Error("EIO: i/o error, write"), {
                        code: "EIO"
                    });
                    // Fails once part of the first file has been written
                    let bytesWritten = 0;
                    const failsAfter = (count: number) => {
                        bytesWritten += count;
                        if (bytesWritten > 10_000) {
                            partialZipExistedOnFailure = existsSync(partialZipPath);
                            return true;
                        }
                        return false;
                    };
                    const write = output._write.bind(output);
                    const writev = output._writev!.bind(output);
                    output._write = (chunk, encoding, callback) =>
                        failsAfter(chunk.length)
                            ? callback(writeError)
                            : write(chunk, encoding, callback);
                    output._writev = (chunks, callback) => {
                        const count = chunks.reduce(
                            (sum, { chunk }) => sum + chunk.length,
                            0
                        );
                        return failsAfter(count)
                            ? callback(writeError)
                            : writev(chunks, callback);
                    };
                    return output;
                }
            });

            const job = await runBackup(service);

            expect(job.status).toBe("failed");
            expect(job.errorMessage).toMatch(/i\/o error, write/);
            expect(job.zipFileName).toBeNull();
            expect(partialZipExistedOnFailure).toBe(true);
            await expectOnlyPreviousBackup(service, user.id, previous);
        });

        it("fails the job, removes the partial zip and keeps the previous backup on an unexpected error", async () => {
            const { user, files, previous } = await createUserWithBackup();
            const service = new BackupService(user.id, {
                openDecryptedFile: (ref) => {
                    if (ref.fileId === files[1].id) {
                        throw new Error("Unexpected failure opening b.jpg");
                    }
                    return openRealDecryptedFile(ref);
                }
            });

            const job = await runBackup(service);

            expect(job.status).toBe("failed");
            expect(job.errorMessage).toBe("Unexpected failure opening b.jpg");
            expect(job.zipFileName).toBeNull();
            await expectOnlyPreviousBackup(service, user.id, previous);
        });
    });

    describe("backup paths", () => {
        interface FileMetadata {
            id: string;
            name: string;
            backupPath: string;
        }

        async function backupZip(service: BackupService) {
            const job = await runBackup(service);
            expect(job.status).toBe("completed");
            const { filePath } = await service.openDownload(job.id);
            const entries = await readZip(filePath);
            const entry = (name: string) =>
                entries.find((candidate) => candidate.name === name);
            const json = (name: string) =>
                JSON.parse(entry(name)!.data.toString("utf8"));
            /** Extracts the zip onto the real file system and lists the extracted files as zip paths */
            const extract = async () => {
                const dir = path.join(appConfig.backupDir, "..", `extracted-${job.id}`);
                const files = await extractZip(filePath, dir);
                return {
                    dir,
                    files: files.map((file) => file.split(path.sep).join("/")).sort()
                };
            };
            const fileEntryNames = entries
                .map((zipEntry) => zipEntry.name)
                .filter((name) => !name.endsWith("/"))
                .sort();
            return {
                entries,
                entry,
                json,
                manifest: json("manifest.json"),
                extract,
                fileEntryNames
            };
        }

        function backupPathsByName(files: FileMetadata[]) {
            return Object.fromEntries(files.map((file) => [file.name, file.backupPath]));
        }

        it("gives files with the same name, even differing only in case or Unicode normalisation, distinct paths in their collection folder", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const composedCafe = `caf${String.fromCodePoint(0xe9)}.jpg`;
            const decomposedCafe = `cafe${String.fromCodePoint(0x301)}.jpg`;
            const originals = [
                ["beach.jpg", crypto.randomBytes(1_000)],
                ["BEACH.jpg", crypto.randomBytes(1_001)],
                ["beach.jpg", crypto.randomBytes(1_002)],
                [composedCafe, crypto.randomBytes(1_003)],
                [decomposedCafe, crypto.randomBytes(1_004)]
            ] as const;
            for (const [name, content] of originals) {
                await addFile(user.id, holiday.id, name, content);
            }
            const service = new BackupService(user.id);

            const { entry, json, extract, fileEntryNames } = await backupZip(service);

            const { files }: { files: FileMetadata[] } = json("metadata/Holiday.json");
            expect(files.map((file) => file.backupPath.toLowerCase()).sort()).toEqual([
                "files/holiday/beach (2).jpg",
                "files/holiday/beach (3).jpg",
                "files/holiday/beach.jpg",
                `files/holiday/caf${String.fromCodePoint(0xe9)} (2).jpg`,
                `files/holiday/caf${String.fromCodePoint(0xe9)}.jpg`
            ]);
            // Every original's bytes are in the zip under the path its metadata records
            const contents = files.map((file) => entry(file.backupPath)!.data);
            for (const [, original] of originals) {
                expect(contents.filter((data) => data.equals(original))).toHaveLength(1);
            }
            expect(files.map((file) => file.name).sort()).toEqual(
                originals.map(([name]) => name).sort()
            );
            expect((await extract()).files).toEqual(fileEntryNames);
        });

        it("makes collection and file names with illegal characters, reserved names and trailing dots or spaces safe to extract", async () => {
            const user = await createUser("alice");
            const trip = await createCollection(user.id, 'Trip: 1/2 <"best"> | ok?*');
            const reserved = await createCollection(user.id, "CON");
            const dots = await createCollection(user.id, "..");
            const trailing = await createCollection(user.id, "Notes. . ");
            // Reserved once truncation drops everything after the spaces
            const reservedWhenTruncated = await createCollection(
                user.id,
                `PRN${" ".repeat(200)}x`
            );
            const controlCharacterName = `tab\there${String.fromCharCode(1)}.jpg`;
            const truncatedToReservedName = `aux${" ".repeat(200)}x`;
            const unsafeNames = [
                "a\\b.jpg",
                controlCharacterName,
                "nul.jpg",
                "COM1.mov",
                "CON .jpg",
                truncatedToReservedName,
                "...jpg",
                "photo.jpg. ",
                "lpt9.backup.png"
            ];
            for (const name of unsafeNames) {
                await addFile(user.id, trip.id, name, crypto.randomBytes(10));
            }
            await addFile(user.id, reserved.id, "x.jpg", crypto.randomBytes(10));
            await addFile(user.id, dots.id, "y.jpg", crypto.randomBytes(10));
            await addFile(user.id, trailing.id, "z.jpg", crypto.randomBytes(10));
            await addFile(user.id, reservedWhenTruncated.id, "w.jpg", crypto.randomBytes(10));
            const service = new BackupService(user.id);

            const { json, manifest, extract, fileEntryNames } = await backupZip(service);

            expect(
                manifest.collections.map(
                    (collection: { name: string; folder: string; metadataPath: string }) => [
                        collection.name,
                        collection.folder,
                        collection.metadataPath
                    ]
                )
            ).toEqual([
                ["..", "_", "metadata/_.json"],
                ["CON", "CON_", "metadata/CON_.json"],
                ["Notes. . ", "Notes", "metadata/Notes.json"],
                [`PRN${" ".repeat(200)}x`, "PRN_", "metadata/PRN_.json"],
                [
                    'Trip: 1/2 <"best"> | ok?*',
                    "Trip_ 1_2 __best__ _ ok__",
                    "metadata/Trip_ 1_2 __best__ _ ok__.json"
                ]
            ]);
            const folder = "files/Trip_ 1_2 __best__ _ ok__";
            expect(
                backupPathsByName(json("metadata/Trip_ 1_2 __best__ _ ok__.json").files)
            ).toEqual({
                "a\\b.jpg": `${folder}/a_b.jpg`,
                [controlCharacterName]: `${folder}/tab_here_.jpg`,
                "nul.jpg": `${folder}/nul_.jpg`,
                "COM1.mov": `${folder}/COM1_.mov`,
                "CON .jpg": `${folder}/CON_ .jpg`,
                [truncatedToReservedName]: `${folder}/aux_.jpg`,
                "...jpg": `${folder}/...jpg`,
                "photo.jpg. ": `${folder}/photo.jpg`,
                "lpt9.backup.png": `${folder}/lpt9_.backup.png`
            });
            expect((await extract()).files).toEqual(fileEntryNames);
        });

        it("gives collections whose names match after sanitisation or in a different case distinct folders", async () => {
            const user = await createUser("alice");
            const question = await createCollection(user.id, "Trip?");
            const star = await createCollection(user.id, "Trip*");
            const lower = await createCollection(user.id, "trip_");
            const questionPhoto = crypto.randomBytes(10);
            const starPhoto = crypto.randomBytes(11);
            const lowerPhoto = crypto.randomBytes(12);
            await addFile(user.id, question.id, "photo.jpg", questionPhoto);
            await addFile(user.id, star.id, "photo.jpg", starPhoto);
            await addFile(user.id, lower.id, "photo.jpg", lowerPhoto);
            const service = new BackupService(user.id);

            const { entry, json, manifest, extract, fileEntryNames } = await backupZip(service);

            const collections: { id: string; folder: string; metadataPath: string }[] =
                manifest.collections;
            expect(collections.map((collection) => collection.folder.toLowerCase()).sort()).toEqual([
                "trip_",
                "trip_ (2)",
                "trip_ (3)"
            ]);
            for (const [collection, photo] of [
                [question, questionPhoto],
                [star, starPhoto],
                [lower, lowerPhoto]
            ] as const) {
                const { folder, metadataPath } = collections.find(
                    (candidate) => candidate.id === collection.id
                )!;
                expect(metadataPath).toBe(`metadata/${folder}.json`);
                const metadata = json(metadataPath);
                expect(metadata.id).toBe(collection.id);
                expect(metadata.files[0].backupPath).toBe(`files/${folder}/photo.jpg`);
                expect(entry(`files/${folder}/photo.jpg`)!.data.equals(photo)).toBe(true);
            }
            expect((await extract()).files).toEqual(fileEntryNames);
        });

        it("truncates very long names to 100 bytes, keeping the extension and uniqueness", async () => {
            const user = await createUser("alice");
            const longCollectionName = "C".repeat(300);
            const collection = await createCollection(user.id, longCollectionName);
            const longName = `${"x".repeat(300)}.jpg`;
            const multibyteName = `${"é".repeat(200)}.png`;
            const first = await addFile(user.id, collection.id, longName, crypto.randomBytes(10));
            const second = await addFile(user.id, collection.id, longName, crypto.randomBytes(10));
            const multibyte = await addFile(user.id, collection.id, multibyteName, crypto.randomBytes(10));
            const service = new BackupService(user.id);

            const { json, manifest, extract, fileEntryNames } = await backupZip(service);

            const folder = "C".repeat(100);
            expect(manifest.collections[0]).toMatchObject({
                name: longCollectionName,
                folder,
                metadataPath: `metadata/${folder}.json`
            });
            const { files }: { files: FileMetadata[] } = json(`metadata/${folder}.json`);
            const byId = Object.fromEntries(files.map((file) => [file.id, file]));
            expect([byId[first.id].backupPath, byId[second.id].backupPath].sort()).toEqual([
                `files/${folder}/${"x".repeat(92)} (2).jpg`,
                `files/${folder}/${"x".repeat(96)}.jpg`
            ]);
            expect(byId[first.id].name).toBe(longName);
            expect(byId[multibyte.id]).toMatchObject({
                name: multibyteName,
                backupPath: `files/${folder}/${"é".repeat(48)}.png`
            });
            expect((await extract()).files).toEqual(fileEntryNames);
        });

        it("adds an extension from the MIME type only to file names without one", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const withoutExtension = [
                ["IMG_0001", "image/jpeg", "IMG_0001.jpg"],
                ["screenshot", "image/png", "screenshot.png"],
                ["clip", "video/mp4", "clip.mp4"],
                ["movie", "video/quicktime", "movie.mov"],
                ["mystery", "application/x-unknown", "mystery"],
                // A dot inside a name does not start an extension
                ["IMG 1.5", "image/jpeg", "IMG 1.5.jpg"],
                ["Photo by J. Smith", "image/png", "Photo by J. Smith.png"]
            ];
            const withExtension = [
                // A converted video keeps its original name
                ["converted.avi", "video/quicktime", "converted.avi"],
                ["photo.JPEG", "image/jpeg", "photo.JPEG"],
                ["archive.tar.gz", "image/png", "archive.tar.gz"],
                [".jpg", "image/png", ".jpg"]
            ];
            for (const [name, mimeType] of [...withoutExtension, ...withExtension]) {
                await addFile(user.id, holiday.id, name, crypto.randomBytes(10), { mimeType });
            }
            const service = new BackupService(user.id);

            const { json, extract, fileEntryNames } = await backupZip(service);

            expect(backupPathsByName(json("metadata/Holiday.json").files)).toEqual(
                Object.fromEntries(
                    [...withoutExtension, ...withExtension].map(([name, , fileName]) => [
                        name,
                        `files/Holiday/${fileName}`
                    ])
                )
            );
            expect((await extract()).files).toEqual(fileEntryNames);
        });

        it("includes empty collections as an empty folder alongside their metadata", async () => {
            const user = await createUser("alice");
            await createCollection(user.id, "Empty?");
            const holiday = await createCollection(user.id, "Holiday");
            await addFile(user.id, holiday.id, "beach.jpg", crypto.randomBytes(10));
            const service = new BackupService(user.id);

            const { entries, manifest, extract } = await backupZip(service);

            expect(entries.map((entry) => entry.name).sort()).toEqual([
                "files/Empty_/",
                "files/Holiday/beach.jpg",
                "manifest.json",
                "metadata/Empty_.json",
                "metadata/Holiday.json"
            ]);
            expect(manifest.collections[0]).toMatchObject({
                name: "Empty?",
                folder: "Empty_",
                fileCount: 0
            });
            const { dir } = await extract();
            expect(await listFiles(path.join(dir, "files", "Empty_"))).toEqual([]);
        });
    });

    describe("skipped and damaged files", () => {
        async function readBackup(service: BackupService, jobId: string) {
            const entries = await readZip((await service.openDownload(jobId)).filePath);
            const entry = (name: string) =>
                entries.find((candidate) => candidate.name === name);
            const json = (name: string) =>
                JSON.parse(entry(name)!.data.toString("utf8"));
            return { entries, entry, json, manifest: json("manifest.json") };
        }

        it("skips a file whose encrypted content is missing and completes with errors, keeping other files intact", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const a = crypto.randomBytes(1_000);
            const c = crypto.randomBytes(3_000);
            await addFile(user.id, holiday.id, "a.jpg", a);
            const missing = await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(2_000));
            await addFile(user.id, holiday.id, "c.jpg", c);
            await unlink(encryptedFilePath(user.id, holiday.id, missing.id));
            const service = new BackupService(user.id);

            const job = await runBackup(service);

            expect(job.status).toBe("completedWithErrors");
            expect(job.skippedCount).toBe(1);
            expect(job.damagedCount).toBe(0);
            expect(job.problems).toEqual([
                {
                    fileId: missing.id,
                    collectionId: holiday.id,
                    name: "b.jpg",
                    kind: "skipped",
                    reason: expect.stringMatching(/missing/i),
                    bytesWritten: null,
                    bytesExpected: null
                }
            ]);
            const { entries, entry, json, manifest } = await readBackup(service, job.id);
            expect(entries.map((zipEntry) => zipEntry.name)).toEqual([
                "files/Holiday/a.jpg",
                "files/Holiday/c.jpg",
                "metadata/Holiday.json",
                "manifest.json"
            ]);
            expect(entry("files/Holiday/a.jpg")!.data.equals(a)).toBe(true);
            expect(entry("files/Holiday/c.jpg")!.data.equals(c)).toBe(true);
            expect(manifest.outcome).toBe("completedWithErrors");
            expect(manifest.problems).toEqual(job.problems);
            expect(manifest.totals).toEqual({ files: 2, bytes: 4_000 });
            expect(manifest.collections[0].fileCount).toBe(3);
            const { files } = json("metadata/Holiday.json");
            expect(files[1]).toMatchObject({
                id: missing.id,
                name: "b.jpg",
                status: "skipped",
                backupPath: null,
                sizeBytes: null,
                sha256: null
            });
            expect(files.map((file: { status: string }) => file.status)).toEqual([
                "included",
                "skipped",
                "included"
            ]);
        });

        it("skips files whose encrypted content is too short or changed size after the job started", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const a = crypto.randomBytes(200_000);
            await addFile(user.id, holiday.id, "a.jpg", a);
            const grown = await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(2_000));
            const truncated = await addFile(user.id, holiday.id, "c.jpg", crypto.randomBytes(2_000));
            await truncate(encryptedFilePath(user.id, holiday.id, truncated.id), 10);
            const opener = createHoldingOpener();
            const service = new BackupService(user.id, {
                openDecryptedFile: opener.openDecryptedFile
            });

            const started = await service.start();
            await waitFor(
                () => service.getJob(started.id),
                (job) => job.progress.bytesDone > 0
            );
            await appendFile(
                encryptedFilePath(user.id, holiday.id, grown.id),
                crypto.randomBytes(100)
            );
            opener.release();
            const job = await waitFor(
                () => service.getJob(started.id),
                (current) => !isActiveBackupJobStatus(current.status)
            );

            expect(job.status).toBe("completedWithErrors");
            expect(job.skippedCount).toBe(2);
            expect(job.problems).toEqual([
                expect.objectContaining({
                    fileId: grown.id,
                    kind: "skipped",
                    reason: expect.stringMatching(/2000 .*2100 bytes/)
                }),
                expect.objectContaining({
                    fileId: truncated.id,
                    kind: "skipped",
                    reason: expect.stringMatching(/too short/)
                })
            ]);
            const { entries, entry, json } = await readBackup(service, job.id);
            expect(entries.map((zipEntry) => zipEntry.name)).toEqual([
                "files/Holiday/a.jpg",
                "metadata/Holiday.json",
                "manifest.json"
            ]);
            expect(entry("files/Holiday/a.jpg")!.data.equals(a)).toBe(true);
            expect(
                json("metadata/Holiday.json").files.map(
                    (file: { status: string }) => file.status
                )
            ).toEqual(["included", "skipped", "skipped"]);
        });

        it("skips a file deleted while the job runs, recording it as it was in the snapshot", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const a = crypto.randomBytes(200_000);
            const c = crypto.randomBytes(3_000);
            await addFile(user.id, holiday.id, "a.jpg", a);
            const deleted = await addFile(user.id, holiday.id, "b.jpg", crypto.randomBytes(2_000), {
                tags: ["gone"]
            });
            await addThumbnail(user.id, holiday.id, deleted.id, crypto.randomBytes(100));
            await addFile(user.id, holiday.id, "c.jpg", c);
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
            await db.models.CollectionFile.destroy({ where: { id: deleted.id } });
            await new UserFileSystem(user.id).deleteFileAndThumbnail(holiday.id, deleted.id);
            opener.release();
            const job = await waitFor(
                () => service.getJob(started.id),
                (current) => !isActiveBackupJobStatus(current.status)
            );

            expect(job.status).toBe("completedWithErrors");
            expect(job.problems).toEqual([
                expect.objectContaining({ fileId: deleted.id, name: "b.jpg", kind: "skipped" })
            ]);
            const { entry, json, manifest } = await readBackup(service, job.id);
            expect(entry("files/Holiday/a.jpg")!.data.equals(a)).toBe(true);
            expect(entry("files/Holiday/c.jpg")!.data.equals(c)).toBe(true);
            expect(entry("files/Holiday/b.jpg")).toBeUndefined();
            expect(manifest.problems).toEqual(job.problems);
            expect(json("metadata/Holiday.json").files[1]).toMatchObject({
                id: deleted.id,
                name: "b.jpg",
                status: "skipped",
                backupPath: null,
                tags: ["gone"]
            });
        });

        it("records a file whose stream fails partway as damaged, with bytes written vs expected, and backs up later files", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const a = crypto.randomBytes(1_000);
            const b = crypto.randomBytes(5_000);
            const c = crypto.randomBytes(3_000);
            await addFile(user.id, holiday.id, "a.jpg", a);
            const damaged = await addFile(user.id, holiday.id, "b.jpg", b);
            await addFile(user.id, holiday.id, "c.jpg", c);
            const service = new BackupService(user.id, {
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
                            let content = Buffer.alloc(0);
                            for await (const chunk of real) {
                                content = Buffer.concat([content, chunk]);
                            }
                            yield content.subarray(0, 1_000);
                            throw Object.assign(new Error("EIO: i/o error, read"), {
                                code: "EIO"
                            });
                        })()
                    );
                }
            });

            const job = await runBackup(service);

            expect(job.status).toBe("completedWithErrors");
            expect(job.skippedCount).toBe(0);
            expect(job.damagedCount).toBe(1);
            expect(job.problems).toEqual([
                {
                    fileId: damaged.id,
                    collectionId: holiday.id,
                    name: "b.jpg",
                    kind: "damaged",
                    reason: expect.stringMatching(/i\/o error/),
                    bytesWritten: 1_000,
                    bytesExpected: 5_000
                }
            ]);
            const { entries, entry, json, manifest } = await readBackup(service, job.id);
            expect(entries.map((zipEntry) => zipEntry.name)).toEqual([
                "files/Holiday/a.jpg",
                "files/Holiday/b.jpg",
                "files/Holiday/c.jpg",
                "metadata/Holiday.json",
                "manifest.json"
            ]);
            expect(entry("files/Holiday/a.jpg")!.data.equals(a)).toBe(true);
            expect(entry("files/Holiday/b.jpg")!.data.equals(b.subarray(0, 1_000))).toBe(true);
            expect(entry("files/Holiday/c.jpg")!.data.equals(c)).toBe(true);
            expect(manifest.outcome).toBe("completedWithErrors");
            expect(manifest.problems).toEqual(job.problems);
            expect(manifest.totals).toEqual({ files: 2, bytes: 4_000 });
            expect(json("metadata/Holiday.json").files[1]).toMatchObject({
                id: damaged.id,
                status: "damaged",
                backupPath: "files/Holiday/b.jpg",
                sizeBytes: 1_000,
                sha256: null
            });
        });

        it("records a file whose stream ends early without an error as damaged", async () => {
            const user = await createUser("alice");
            const holiday = await createCollection(user.id, "Holiday");
            const b = crypto.randomBytes(5_000);
            const c = crypto.randomBytes(3_000);
            const shortened = await addFile(user.id, holiday.id, "b.jpg", b);
            await addFile(user.id, holiday.id, "c.jpg", c);
            const service = new BackupService(user.id, {
                openDecryptedFile: (ref) =>
                    ref.fileId === shortened.id
                        ? Readable.from([b.subarray(0, 1_000)], { objectMode: false })
                        : new UserFileSystem(ref.userId).openDecryptedFile(
                              ref.collectionId,
                              ref.fileId
                          )
            });

            const job = await runBackup(service);

            expect(job.status).toBe("completedWithErrors");
            expect(job.problems).toEqual([
                expect.objectContaining({
                    fileId: shortened.id,
                    kind: "damaged",
                    reason: expect.stringMatching(/ended after 1000 of 5000 bytes/),
                    bytesWritten: 1_000,
                    bytesExpected: 5_000
                })
            ]);
            const { entry, json } = await readBackup(service, job.id);
            expect(entry("files/Holiday/c.jpg")!.data.equals(c)).toBe(true);
            expect(json("metadata/Holiday.json").files[0]).toMatchObject({
                id: shortened.id,
                status: "damaged",
                sizeBytes: 1_000,
                sha256: null
            });
        });
    });

    describe("queue", () => {
        async function waitUntilFinished(service: BackupService, jobId: string) {
            return waitFor(
                () => service.getJob(jobId),
                (job) => !isActiveBackupJobStatus(job.status)
            );
        }

        it("runs one backup job at a time across users, starting a queued job when the running one ends", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            const aliceHoliday = await createCollection(alice.id, "Holiday");
            const bobHoliday = await createCollection(bob.id, "Holiday");
            await addFile(alice.id, aliceHoliday.id, "a.jpg", crypto.randomBytes(200_000));
            await addFile(bob.id, bobHoliday.id, "b.jpg", crypto.randomBytes(1_000));
            const opener = createHoldingOpener();
            const aliceService = new BackupService(alice.id, {
                openDecryptedFile: opener.openDecryptedFile
            });
            const bobService = new BackupService(bob.id);

            const aliceStarted = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(aliceStarted.id),
                (job) => job.progress.bytesDone > 0
            );
            const bobStarted = await bobService.start();

            expect(bobStarted.status).toBe("queued");
            // Still waiting well after it would have finished on its own
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect((await bobService.getJob(bobStarted.id)).status).toBe("queued");
            expect((await aliceService.getJob(aliceStarted.id)).status).toBe("running");

            opener.release();
            const aliceJob = await waitUntilFinished(aliceService, aliceStarted.id);
            const bobJob = await waitUntilFinished(bobService, bobStarted.id);

            expect(aliceJob.status).toBe("completed");
            expect(bobJob.status).toBe("completed");
            expect(bobJob.startedAt!).toBeGreaterThanOrEqual(aliceJob.finishedAt!);
        });

        it("starts queued jobs in the order they were queued", async () => {
            const users = [];
            for (const username of ["alice", "bob", "carol", "dave"]) {
                const user = await createUser(username);
                const holiday = await createCollection(user.id, "Holiday");
                await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
                users.push(user);
            }
            const opener = createHoldingOpener();
            const [aliceService, ...queuedServices] = users.map(
                (user) =>
                    new BackupService(user.id, {
                        openDecryptedFile: opener.openDecryptedFile
                    })
            );

            const aliceStarted = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(aliceStarted.id),
                (job) => job.progress.bytesDone > 0
            );
            const queued = [];
            for (const service of queuedServices) {
                queued.push(await service.start());
            }
            opener.release();
            const finished = [];
            for (let index = 0; index < queuedServices.length; index++) {
                finished.push(
                    await waitUntilFinished(queuedServices[index], queued[index].id)
                );
            }

            expect(finished.map((job) => job.status)).toEqual([
                "completed",
                "completed",
                "completed"
            ]);
            expect(finished[1].startedAt!).toBeGreaterThanOrEqual(finished[0].finishedAt!);
            expect(finished[2].startedAt!).toBeGreaterThanOrEqual(finished[1].finishedAt!);
        });

        it("returns the user's queued or running job instead of starting another", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            for (const user of [alice, bob]) {
                const holiday = await createCollection(user.id, "Holiday");
                await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
            }
            const opener = createHoldingOpener();
            const aliceService = new BackupService(alice.id, {
                openDecryptedFile: opener.openDecryptedFile
            });
            const bobService = new BackupService(bob.id);

            const aliceRunning = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(aliceRunning.id),
                (job) => job.progress.bytesDone > 0
            );
            const bobQueued = await bobService.start();
            // Concurrent requests too, as from a double click
            const aliceAgain = await Promise.all([
                aliceService.start(),
                aliceService.start()
            ]);
            const bobAgain = await Promise.all([bobService.start(), bobService.start()]);

            expect(aliceAgain.map((job) => job.id)).toEqual([
                aliceRunning.id,
                aliceRunning.id
            ]);
            expect(aliceAgain[0].status).toBe("running");
            expect(bobAgain.map((job) => job.id)).toEqual([bobQueued.id, bobQueued.id]);
            expect(bobAgain[0].status).toBe("queued");
            expect(await aliceService.getJobs()).toHaveLength(1);
            expect(await bobService.getJobs()).toHaveLength(1);

            opener.release();
            await waitUntilFinished(bobService, bobQueued.id);
            // Once finished, a new backup can be started
            const next = await runBackup(aliceService);
            expect(next.id).not.toBe(aliceRunning.id);
            expect(next.status).toBe("completed");
        });
    });

    describe("cancellation", () => {
        async function listBackupDirOrEmpty(userId: string) {
            return listUserBackupDir(userId).catch(() => []);
        }

        it("cancels a queued job so that it never runs", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            for (const user of [alice, bob]) {
                const holiday = await createCollection(user.id, "Holiday");
                await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
            }
            const opener = createHoldingOpener();
            const aliceService = new BackupService(alice.id, {
                openDecryptedFile: opener.openDecryptedFile
            });
            const bobService = new BackupService(bob.id);
            const aliceStarted = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(aliceStarted.id),
                (job) => job.progress.bytesDone > 0
            );
            const bobQueued = await bobService.start();

            const cancelled = await bobService.cancel(bobQueued.id);

            expect(cancelled.status).toBe("cancelled");
            expect(cancelled.finishedAt).not.toBeNull();
            opener.release();
            const aliceJob = await waitFor(
                () => aliceService.getJob(aliceStarted.id),
                (job) => !isActiveBackupJobStatus(job.status)
            );
            expect(aliceJob.status).toBe("completed");
            // Give a wrongly started job time to show up
            await new Promise((resolve) => setTimeout(resolve, 500));
            const bobJob = await bobService.getJob(bobQueued.id);
            expect(bobJob.status).toBe("cancelled");
            expect(bobJob.startedAt).toBeNull();
            expect(await listBackupDirOrEmpty(bob.id)).toEqual([]);
        });

        it("stops a running job promptly, deletes its partial zip and keeps the previous backup, then runs the next queued job", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            const holiday = await createCollection(alice.id, "Holiday");
            await addFile(alice.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
            await addFile(alice.id, holiday.id, "b.jpg", crypto.randomBytes(50_000));
            const bobHoliday = await createCollection(bob.id, "Holiday");
            await addFile(bob.id, bobHoliday.id, "a.jpg", crypto.randomBytes(1_000));
            const previous = await runBackup(new BackupService(alice.id));
            const opener = createHoldingOpener();
            const aliceService = new BackupService(alice.id, {
                openDecryptedFile: opener.openDecryptedFile
            });
            const bobService = new BackupService(bob.id);
            const started = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(started.id),
                (job) => job.progress.bytesDone > 0
            );
            expect(await listUserBackupDir(alice.id)).toContainEqual(
                expect.stringMatching(/\.zip\.partial$/)
            );
            const bobQueued = await bobService.start();

            try {
                // The held file never finishes, so only cancellation can end the job
                const cancelled = await aliceService.cancel(started.id);

                expect(cancelled.status).toBe("cancelled");
                expect(cancelled.finishedAt).not.toBeNull();
                expect(cancelled.zipFileName).toBeNull();
                expect(await listUserBackupDir(alice.id)).toEqual([previous.zipFileName]);
                const download = await aliceService.openDownload(previous.id);
                expect((await readZip(download.filePath)).at(-1)!.name).toBe(
                    "manifest.json"
                );
                await expect(aliceService.openDownload(started.id)).rejects.toThrow(
                    NotFoundError
                );
                const bobJob = await waitFor(
                    () => bobService.getJob(bobQueued.id),
                    (job) => !isActiveBackupJobStatus(job.status)
                );
                expect(bobJob.status).toBe("completed");
                expect((await aliceService.getJob(started.id)).status).toBe("cancelled");
            } finally {
                opener.release();
            }
        });

        it("only lets a job's owner cancel it", async () => {
            const alice = await createUser("alice");
            const bob = await createUser("bob");
            const holiday = await createCollection(alice.id, "Holiday");
            await addFile(alice.id, holiday.id, "a.jpg", crypto.randomBytes(200_000));
            const opener = createHoldingOpener();
            const aliceService = new BackupService(alice.id, {
                openDecryptedFile: opener.openDecryptedFile
            });
            const bobService = new BackupService(bob.id);
            const started = await aliceService.start();
            await waitFor(
                () => aliceService.getJob(started.id),
                (job) => job.progress.bytesDone > 0
            );

            await expect(bobService.cancel(started.id)).rejects.toThrow(NotFoundError);
            await expect(bobService.cancel("not-a-uuid")).rejects.toThrow(NotFoundError);

            expect((await aliceService.getJob(started.id)).status).toBe("running");
            opener.release();
            const job = await waitFor(
                () => aliceService.getJob(started.id),
                (current) => !isActiveBackupJobStatus(current.status)
            );
            expect(job.status).toBe("completed");
        });

        it("leaves a finished job as it is", async () => {
            const alice = await createUser("alice");
            await createCollection(alice.id, "Holiday");
            const service = new BackupService(alice.id);
            const completed = await runBackup(service);

            const result = await service.cancel(completed.id);

            expect(result.status).toBe("completed");
            expect(await listUserBackupDir(alice.id)).toEqual([completed.zipFileName]);
        });
    });

    describe("startup recovery", () => {
        it("fails jobs left running, removes partial zips, keeps completed backups and starts queued jobs in order", async () => {
            const db = await getTestDatabase();
            const users = [];
            for (const username of ["alice", "bob", "carol", "dave"]) {
                const user = await createUser(username);
                const holiday = await createCollection(user.id, "Holiday");
                await addFile(user.id, holiday.id, "a.jpg", crypto.randomBytes(1_000));
                users.push(user);
            }
            const [alice, bob, carol, dave] = users;
            const previous = await runBackup(new BackupService(alice.id));
            // Left behind by a server that stopped mid-backup
            const interrupted = await db.models.BackupJob.create({
                UserId: alice.id,
                status: "running",
                queuedAt: new Date(Date.now() - 60_000),
                startedAt: new Date(Date.now() - 59_000),
                filesDone: 1,
                currentFileName: "a.jpg"
            });
            const aliceDir = path.join(appConfig.backupDir, alice.id);
            const daveDir = path.join(appConfig.backupDir, dave.id);
            await writeFile(path.join(aliceDir, "holvi-backup-alice-1.zip.partial"), "partial");
            await mkdir(daveDir, { recursive: true });
            await writeFile(path.join(daveDir, "holvi-backup-dave-1.zip.partial"), "stray");
            const bobQueued = await db.models.BackupJob.create({
                UserId: bob.id,
                status: "queued",
                queuedAt: new Date(Date.now() - 30_000)
            });
            const carolQueued = await db.models.BackupJob.create({
                UserId: carol.id,
                status: "queued",
                queuedAt: new Date(Date.now() - 20_000)
            });

            await BackupService.recover();

            const aliceService = new BackupService(alice.id);
            const failed = await aliceService.getJob(interrupted.id);
            expect(failed).toMatchObject({
                status: "failed",
                errorMessage: expect.stringMatching(/server restarted/i),
                zipFileName: null,
                progress: expect.objectContaining({ currentFileName: null })
            });
            expect(failed.finishedAt).not.toBeNull();
            expect(await listUserBackupDir(alice.id)).toEqual([previous.zipFileName]);
            expect(await listUserBackupDir(dave.id)).toEqual([]);
            expect((await aliceService.getJob(previous.id)).status).toBe("completed");
            const bobService = new BackupService(bob.id);
            const carolService = new BackupService(carol.id);
            const bobJob = await waitFor(
                () => bobService.getJob(bobQueued.id),
                (job) => !isActiveBackupJobStatus(job.status)
            );
            const carolJob = await waitFor(
                () => carolService.getJob(carolQueued.id),
                (job) => !isActiveBackupJobStatus(job.status)
            );
            expect(bobJob.status).toBe("completed");
            expect(carolJob.status).toBe("completed");
            expect(carolJob.startedAt!).toBeGreaterThanOrEqual(bobJob.finishedAt!);
            expect(await listUserBackupDir(bob.id)).toEqual([bobJob.zipFileName]);
        });
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

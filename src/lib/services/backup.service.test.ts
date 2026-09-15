import crypto from "crypto";
import { Readable } from "stream";
import { beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    createCollection,
    createHoldingOpener,
    createUser,
    hasZip64EndOfCentralDirectory,
    listFiles,
    listUserBackupDir,
    readZip,
    waitFor
} from "../../../test/backup-fixtures";
import { resetDatabase } from "../../../test/database";
import appConfig from "../common/app-config";
import { NotFoundError } from "../common/errors";
import { isActiveBackupJobStatus } from "../types/backup-job-dto";
import { BackupService } from "./backup.service";

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
        await addFile(user.id, holiday.id, "sunset.mp4", sunset, "video/mp4");
        await addFile(user.id, pets.id, "cat.png", cat, "image/png");
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

    it("writes a minimal manifest as the final entry, stores files uncompressed and uses ZIP64", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        const pets = await createCollection(user.id, "Pets");
        await addFile(user.id, holiday.id, "beach.jpg", crypto.randomBytes(5_000));
        await addFile(user.id, pets.id, "cat.png", crypto.randomBytes(5_000));
        const service = new BackupService(user.id);

        const job = await runBackup(service);

        const { filePath } = await service.openDownload(job.id);
        const entries = await readZip(filePath);
        const last = entries.at(-1)!;
        expect(last.name).toBe("manifest.json");
        const manifest = JSON.parse(last.data.toString("utf8"));
        expect(manifest).toEqual({
            formatVersion: 1,
            schemaVersion: 4,
            snapshotAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            ),
            user: { id: user.id, username: "alice" },
            collections: [
                { id: holiday.id, name: "Holiday", fileCount: 1 },
                { id: pets.id, name: "Pets", fileCount: 1 }
            ]
        });
        const STORE = 0;
        const DEFLATE = 8;
        for (const entry of entries) {
            expect(entry.compressionMethod).toBe(
                entry.name.endsWith(".json") ? DEFLATE : STORE
            );
        }
        expect(await hasZip64EndOfCentralDirectory(filePath)).toBe(true);
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

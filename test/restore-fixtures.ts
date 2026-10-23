import appConfig from "@/lib/common/app-config";
import { BackupService } from "@/lib/services/backup.service";
import { EntryCopy } from "@/lib/services/restore.service";
import { Readable } from "stream";
import { isActiveBackupJobStatus } from "@/lib/types/backup-job-dto";
import archiver from "archiver";
import { createWriteStream } from "fs";
import { copyFile, mkdir, rm } from "fs/promises";
import path from "path";
import { readZip } from "./backup-fixtures";
import { getTestDatabase } from "./database";
import { waitFor } from "./fixtures";

// Helpers only the restore tests need. Users, collections, files and tags come from ./fixtures.

/** Runs a Backup job for the user and returns the path of the zip it left behind */
export async function makeBackup(
    userId: string,
    options?: ConstructorParameters<typeof BackupService>[1]
) {
    const service = new BackupService(userId, options);
    const started = await service.start();
    const job = await waitFor(
        () => service.getJob(started.id),
        (job) => !isActiveBackupJobStatus(job.status)
    );
    const { filePath } = await service.openDownload(job.id);
    return filePath;
}

/** Copies a zip into the user's folder in the restore directory, as an operator would */
export async function placeInRestoreFolder(
    username: string,
    zipPath: string,
    fileName = "backup.zip"
) {
    const folder = path.join(appConfig.restoreDir, username);
    await mkdir(folder, { recursive: true });
    const placedPath = path.join(folder, fileName);
    await copyFile(zipPath, placedPath);
    return placedPath;
}

/** Deletes every collection the user has, with their files on disk: the data loss a Restore recovers from */
export async function deleteAllContent(userId: string) {
    const db = await getTestDatabase();
    await db.models.Collection.destroy({ where: { UserId: userId } });
    await rm(path.join(appConfig.dataDir, userId), {
        recursive: true,
        force: true
    });
}

/**
 * Writes a copy of a Backup zip with entries changed the way the Backup
 * writer would store them: files uncompressed, JSON deflated, ZIP64.
 * `edit` returns an entry's new content, or null to leave it out.
 */
export async function rewriteZip(
    sourcePath: string,
    targetPath: string,
    edit: (name: string, data: Buffer) => Buffer | null
) {
    const archive = archiver("zip", { forceZip64: true });
    const output = createWriteStream(targetPath);
    const closed = new Promise<void>((resolve, reject) => {
        output.on("close", resolve);
        output.on("error", reject);
        archive.on("error", reject);
    });
    archive.pipe(output);
    for (const entry of await readZip(sourcePath)) {
        const data = edit(entry.name, entry.data);
        if (data === null) {
            continue;
        }
        archive.append(data, {
            name: entry.name,
            // Missing from archiver's types, though supported
            ...({ store: entry.name.startsWith("files/") } as object)
        });
    }
    await archive.finalize();
    await closed;
    return targetPath;
}

/** Changes a JSON entry of a Backup, for use with rewriteZip */
export function editJson(
    data: Buffer,
    change: (value: Record<string, unknown>) => unknown
) {
    const changed = change(JSON.parse(data.toString("utf8")));
    return Buffer.from(JSON.stringify(changed, null, 2));
}

/** A per-entry copy that flips the first byte of the given files, as a bit flip in the zip would */
export function corruptEntries(fileIds: string[]): EntryCopy {
    return (entry, content) => {
        if (!fileIds.includes(entry.fileId)) {
            return content;
        }
        let first = true;
        return Readable.from(
            (async function* () {
                for await (const chunk of content) {
                    const bytes = Buffer.from(chunk);
                    if (first && bytes.length > 0) {
                        bytes[0] ^= 0xff;
                        first = false;
                    }
                    yield bytes;
                }
            })()
        );
    };
}

const holdingCopyReleases: (() => void)[] = [];

/** Releases every holding copy, so a job held by a failed test cannot block the instance's queue */
export function releaseHoldingCopies() {
    holdingCopyReleases.splice(0).forEach((release) => release());
}

/**
 * A per-entry copy that passes through the first chunk of each file and then
 * holds it until released, to observe a Restore job mid-run.
 */
export function createHoldingCopy() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    holdingCopyReleases.push(release);
    let markHolding!: () => void;
    const holding = new Promise<void>((resolve) => (markHolding = resolve));
    const copyEntry: EntryCopy = (_entry, content) =>
        Readable.from(
            (async function* () {
                for await (const chunk of content) {
                    yield chunk;
                    markHolding();
                    await released;
                }
            })()
        );
    /** Resolves once a file is being held */
    return { copyEntry, release, holding };
}

/** Empties the restore directory, so one test's zips are never offered in another */
export async function clearRestoreDir() {
    await rm(appConfig.restoreDir, { recursive: true, force: true });
}

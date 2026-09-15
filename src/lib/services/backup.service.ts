import Database from "@/db/Database";
import { BackupJob } from "@/db/models/BackupJob";
import { Collection } from "@/db/models/Collection";
import archiver, { Archiver } from "archiver";
import { createWriteStream } from "fs";
import { mkdir, open, rename, rm, stat } from "fs/promises";
import path from "path";
import { InferAttributes, Transaction } from "sequelize";
import { Readable, Transform, pipeline } from "stream";
import appConfig from "../common/app-config";
import { NotFoundError } from "../common/errors";
import Log, { LogColor } from "../common/log";
import { UserFileSystem } from "../common/user-file-system";
import { getErrorMessage, isUuidv4, timestamp } from "../common/utilities";
import { BackupJobDto } from "../types/backup-job-dto";

const BACKUP_FORMAT_VERSION = 1;
const PROGRESS_SAVE_INTERVAL_MS = 1_000;

export interface BackupFileRef {
    userId: string;
    collectionId: string;
    fileId: string;
}

/** Opens a file's whole decrypted content. Failures must be emitted as stream errors. */
export type DecryptedFileOpener = (file: BackupFileRef) => Readable;

interface BackupServiceOptions {
    openDecryptedFile?: DecryptedFileOpener;
}

interface BackupDownload {
    filePath: string;
    fileName: string;
    sizeBytes: number;
}

interface Snapshot {
    snapshotAt: Date;
    user: { id: string; username: string };
    collections: Collection[];
}

/** The part of a running job's progress that changes while the zip is written */
interface WriteProgress {
    collectionsDone: number;
    filesDone: number;
    bytesDone: number;
    currentFileName: string | null;
}

type BackupJobFields = Partial<InferAttributes<BackupJob>>;

const logger = new Log("BACKUP", LogColor.GREEN);

export class BackupService {
    private readonly openDecryptedFile: DecryptedFileOpener;

    constructor(
        private readonly userId: string,
        options: BackupServiceOptions = {}
    ) {
        this.openDecryptedFile =
            options.openDecryptedFile ?? openDecryptedFileFromDataDir;
    }

    /** Starts a backup job in the background and returns it immediately. */
    async start(): Promise<BackupJobDto> {
        const db = await Database.getInstance();
        const job = await db.models.BackupJob.create({
            UserId: this.userId,
            status: "queued",
            queuedAt: new Date()
        });
        void runBackupJob(job, this.openDecryptedFile);
        return job.toDto();
    }

    /** The user's backup jobs, latest first */
    async getJobs(): Promise<BackupJobDto[]> {
        const db = await Database.getInstance();
        const jobs = await db.models.BackupJob.findAll({
            where: { UserId: this.userId },
            order: [["queuedAt", "DESC"]]
        });
        return jobs.map((job) => job.toDto());
    }

    async getJob(jobId: string): Promise<BackupJobDto> {
        const job = await this.findUserJob(jobId);
        return job.toDto();
    }

    /** Locates a completed job's backup zip for download */
    async openDownload(jobId: string): Promise<BackupDownload> {
        const job = await this.findUserJob(jobId);
        if (job.status !== "completed" || !job.zipFileName) {
            throw new NotFoundError(
                `Backup job '${jobId}' has no backup to download`
            );
        }
        const filePath = path.join(
            getUserBackupDir(this.userId),
            job.zipFileName
        );
        const stats = await stat(filePath).catch(() => null);
        if (!stats) {
            throw new NotFoundError(`Backup of job '${jobId}' no longer exists`);
        }
        return { filePath, fileName: job.zipFileName, sizeBytes: stats.size };
    }

    private async findUserJob(jobId: string) {
        const db = await Database.getInstance();
        const job = isUuidv4(jobId)
            ? await db.models.BackupJob.findOne({
                  where: { id: jobId, UserId: this.userId }
              })
            : null;
        if (!job) {
            throw new NotFoundError(`Backup job '${jobId}' not found`);
        }
        return job;
    }
}

function openDecryptedFileFromDataDir({
    userId,
    collectionId,
    fileId
}: BackupFileRef) {
    return new UserFileSystem(userId).openDecryptedFile(collectionId, fileId);
}

function getUserBackupDir(userId: string) {
    return path.join(appConfig.backupDir, userId);
}

/**
 * Job state is persisted with targeted updates rather than by saving a shared
 * model instance, so progress changed during an in-flight save is never lost.
 */
async function updateJob(jobId: string, fields: BackupJobFields) {
    const db = await Database.getInstance();
    await db.models.BackupJob.update(fields, { where: { id: jobId } });
}

async function runBackupJob(job: BackupJob, openFile: DecryptedFileOpener) {
    const progress: WriteProgress = {
        collectionsDone: 0,
        filesDone: 0,
        bytesDone: 0,
        currentFileName: null
    };
    const progressSaver = new ProgressSaver(job.id, progress);
    try {
        const snapshot = await readSnapshot(job.UserId);
        const userBackupDir = getUserBackupDir(job.UserId);
        const username = snapshot.user.username.replace(/[^\w-]/g, "_");
        const zipFileName = `holvi-backup-${username}-${timestamp()}.zip`;
        const zipPath = path.join(userBackupDir, zipFileName);

        await updateJob(job.id, {
            status: "running",
            startedAt: new Date(),
            collectionsTotal: snapshot.collections.length,
            filesTotal: snapshot.collections.reduce(
                (sum, collection) => sum + countFiles(collection),
                0
            ),
            bytesTotal: await getTotalBytes(snapshot)
        });
        logger.info(`Backup job '${job.id}' started`);

        await mkdir(userBackupDir, { recursive: true });
        progressSaver.start();
        await writeBackupZip(`${zipPath}.partial`, snapshot, openFile, progress);
        await progressSaver.stop();
        await rename(`${zipPath}.partial`, zipPath);
        const { size } = await stat(zipPath);

        await updateJob(job.id, {
            ...progress,
            status: "completed",
            finishedAt: new Date(),
            currentFileName: null,
            zipFileName,
            zipSizeBytes: size
        });
        logger.info(`Backup job '${job.id}' completed (${size} bytes)`);
    } catch (error) {
        await progressSaver.stop();
        logger.error(`Backup job '${job.id}' failed`, error);
        await updateJob(job.id, {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: getErrorMessage(error)
        }).catch((updateError) =>
            logger.error(
                `Could not mark backup job '${job.id}' failed`,
                updateError
            )
        );
    }
}

/** Reads everything the backup contains in one consistent snapshot */
async function readSnapshot(userId: string): Promise<Snapshot> {
    const db = await Database.getInstance();
    const transaction = await db.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
    });
    try {
        const snapshotAt = new Date();
        const user = await db.models.User.findByPk(userId, {
            transaction,
            rejectOnEmpty: true
        });
        const collections = await db.models.Collection.findAll({
            where: { UserId: userId },
            include: db.models.CollectionFile,
            order: [
                ["name", "ASC"],
                [db.models.CollectionFile, "name", "ASC"]
            ],
            transaction
        });
        await transaction.commit();
        return {
            snapshotAt,
            user: { id: user.id, username: user.username },
            collections
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

function countFiles(collection: Collection) {
    return collection.CollectionFiles?.length ?? 0;
}

async function getTotalBytes({ user, collections }: Snapshot) {
    const fileSystem = new UserFileSystem(user.id);
    let total = 0;
    for (const collection of collections) {
        for (const file of collection.CollectionFiles ?? []) {
            total += await fileSystem
                .getDecryptedFileSize(collection.id, file.id)
                .catch(() => 0);
        }
    }
    return total;
}

/**
 * Writes the zip to `partialZipPath`, flushed to disk. On failure the partial
 * zip is removed, unless it could not be created (e.g. another job owns it).
 */
async function writeBackupZip(
    partialZipPath: string,
    snapshot: Snapshot,
    openFile: DecryptedFileOpener,
    progress: WriteProgress
) {
    const output = createWriteStream(partialZipPath, { flags: "wx" });
    let created = false;
    output.once("open", () => (created = true));
    const outputClosed = new Promise<void>((resolve) =>
        output.once("close", resolve)
    );
    const archive = archiver("zip", { forceZip64: true });
    // Rejects as soon as the zip can no longer be written; never resolves
    const writeFailure = new Promise<never>((_, reject) => {
        archive.on("error", reject);
        output.on("error", reject);
        output.once("close", () =>
            reject(new Error("Zip file closed before it was finalised"))
        );
    });
    // Observed by whichever append is waiting; late rejections are expected
    writeFailure.catch(() => {});
    archive.pipe(output);

    try {
        for (const collection of snapshot.collections) {
            for (const file of collection.CollectionFiles ?? []) {
                progress.currentFileName = file.name;
                const content = pipeline(
                    openFile({
                        userId: snapshot.user.id,
                        collectionId: collection.id,
                        fileId: file.id
                    }),
                    countBytes((count) => (progress.bytesDone += count)),
                    () => {
                        // Errors are forwarded to the byte counter and observed by appendEntry
                    }
                );
                await appendEntry(archive, writeFailure, content, {
                    name: `files/${collection.name}/${file.name}`,
                    store: true
                });
                progress.filesDone += 1;
            }
            progress.collectionsDone += 1;
        }

        const manifest = {
            formatVersion: BACKUP_FORMAT_VERSION,
            schemaVersion: Database.version,
            snapshotAt: snapshot.snapshotAt.toISOString(),
            user: snapshot.user,
            collections: snapshot.collections.map((collection) => ({
                id: collection.id,
                name: collection.name,
                fileCount: countFiles(collection)
            }))
        };
        await appendEntry(
            archive,
            writeFailure,
            Buffer.from(JSON.stringify(manifest, null, 2)),
            { name: "manifest.json" }
        );

        await archive.finalize();
        await outputClosed;
        await flushToDisk(partialZipPath);
    } catch (error) {
        archive.abort();
        output.destroy();
        // The file handle must be released before the file can be deleted (Windows)
        await outputClosed;
        if (created) {
            await rm(partialZipPath, { force: true }).catch((rmError) =>
                logger.error(
                    `Could not delete partial backup '${partialZipPath}'`,
                    rmError
                )
            );
        }
        throw error;
    }
}

/** Appends one entry and waits until it is fully written, so only one source is open at a time */
async function appendEntry(
    archive: Archiver,
    writeFailure: Promise<never>,
    source: Readable | Buffer,
    entry: archiver.EntryData & { store?: boolean }
) {
    let onEntry = () => {};
    const written = new Promise<void>((resolve, reject) => {
        onEntry = resolve;
        archive.once("entry", onEntry);
        if (source instanceof Readable) {
            source.once("error", reject);
        }
    });
    archive.append(source, entry);
    try {
        await Promise.race([written, writeFailure]);
    } finally {
        archive.off("entry", onEntry);
    }
}

async function flushToDisk(filePath: string) {
    const handle = await open(filePath, "r+");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

function countBytes(onCount: (count: number) => void) {
    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            onCount(chunk.length);
            callback(null, chunk);
        }
    });
}

/** Persists a running job's in-memory progress periodically instead of per chunk */
class ProgressSaver {
    private timer: NodeJS.Timeout | null = null;
    private saving: Promise<void> = Promise.resolve();
    private lastSaved = "";

    constructor(
        private readonly jobId: string,
        private readonly progress: WriteProgress
    ) {}

    start() {
        this.timer = setInterval(() => this.save(), PROGRESS_SAVE_INTERVAL_MS);
    }

    async stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.saving;
    }

    private save() {
        const current = { ...this.progress };
        const serialised = JSON.stringify(current);
        if (serialised === this.lastSaved) {
            return;
        }
        this.lastSaved = serialised;
        this.saving = this.saving
            .then(() => updateJob(this.jobId, current))
            .catch((error) =>
                logger.warn(
                    `Could not save progress of backup job '${
                        this.jobId
                    }' (${getErrorMessage(error)})`
                )
            );
    }
}

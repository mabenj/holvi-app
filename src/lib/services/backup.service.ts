import Database from "@/db/Database";
import { BackupJob } from "@/db/models/BackupJob";
import { Collection } from "@/db/models/Collection";
import { CollectionFile } from "@/db/models/CollectionFile";
import { Tag } from "@/db/models/Tag";
import archiver, { Archiver } from "archiver";
import crypto from "crypto";
import { createWriteStream } from "fs";
import { mkdir, open, rename, rm, stat } from "fs/promises";
import path from "path";
import { InferAttributes, Transaction } from "sequelize";
import { Readable, Transform, pipeline } from "stream";
import appConfig from "../common/app-config";
import { UniqueSafeNames } from "../common/backup-paths";
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
    user: { id: string; username: string; requireSignIn: boolean };
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

        const startedAt = new Date();
        await updateJob(job.id, {
            status: "running",
            startedAt,
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
        const finishedAt = await writeBackupZip(
            `${zipPath}.partial`,
            snapshot,
            startedAt,
            openFile,
            progress
        );
        await progressSaver.stop();
        await rename(`${zipPath}.partial`, zipPath);
        const { size } = await stat(zipPath);

        await updateJob(job.id, {
            ...progress,
            status: "completed",
            finishedAt,
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
            include: [
                db.models.Tag,
                {
                    model: db.models.CollectionFile,
                    include: [db.models.Tag]
                }
            ],
            // Fully ordered, so de-duplicated backup paths are stable between backups
            order: [
                ["name", "ASC"],
                ["createdAt", "ASC"],
                ["id", "ASC"],
                [db.models.CollectionFile, "name", "ASC"],
                [db.models.CollectionFile, "createdAt", "ASC"],
                [db.models.CollectionFile, "id", "ASC"]
            ],
            transaction
        });
        await transaction.commit();
        return {
            snapshotAt,
            user: {
                id: user.id,
                username: user.username,
                requireSignIn: user.requireSignIn
            },
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
 * Writes the zip to `partialZipPath`, flushed to disk, and returns the finish
 * time recorded in its manifest. On failure the partial zip is removed, unless
 * it could not be created (e.g. another job owns it).
 */
async function writeBackupZip(
    partialZipPath: string,
    snapshot: Snapshot,
    startedAt: Date,
    openFile: DecryptedFileOpener,
    progress: WriteProgress
): Promise<Date> {
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
        const manifestCollections = [];
        const totals = { files: 0, bytes: 0 };
        const folders = new UniqueSafeNames();
        for (const collection of snapshot.collections) {
            const folder = folders.claim(collection.name);
            const metadataPath = `metadata/${folder}.json`;
            const filesMetadata = [];
            const fileNames = new UniqueSafeNames();
            for (const file of collection.CollectionFiles ?? []) {
                progress.currentFileName = file.name;
                const backupPath = `files/${folder}/${fileNames.claim(
                    file.name,
                    file.mimeType
                )}`;
                const measurer = measureContent(
                    (count) => (progress.bytesDone += count)
                );
                const content = pipeline(
                    openFile({
                        userId: snapshot.user.id,
                        collectionId: collection.id,
                        fileId: file.id
                    }),
                    measurer.stream,
                    () => {
                        // Errors are forwarded to the measurer and observed by appendEntry
                    }
                );
                await appendEntry(archive, writeFailure, content, {
                    name: backupPath,
                    store: true
                });
                filesMetadata.push(
                    toFileMetadata(file, backupPath, measurer.result())
                );
                progress.filesDone += 1;
            }
            if (filesMetadata.length === 0) {
                await appendEntry(archive, writeFailure, Buffer.alloc(0), {
                    name: `files/${folder}/`,
                    type: "directory"
                });
            }
            await appendEntry(
                archive,
                writeFailure,
                toJsonBuffer(toCollectionMetadata(collection, filesMetadata)),
                { name: metadataPath }
            );
            manifestCollections.push({
                id: collection.id,
                name: collection.name,
                folder,
                metadataPath,
                fileCount: filesMetadata.length
            });
            for (const file of filesMetadata) {
                totals.files += 1;
                totals.bytes += file.sizeBytes;
            }
            progress.collectionsDone += 1;
        }

        const finishedAt = new Date();
        const manifest = {
            formatVersion: BACKUP_FORMAT_VERSION,
            schemaVersion: Database.version,
            snapshotAt: snapshot.snapshotAt.toISOString(),
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            outcome: "completed",
            user: snapshot.user,
            collections: manifestCollections,
            totals
        };
        await appendEntry(
            archive,
            writeFailure,
            toJsonBuffer(manifest),
            { name: "manifest.json" }
        );

        await archive.finalize();
        await outputClosed;
        await flushToDisk(partialZipPath);
        return finishedAt;
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
    // Missing from archiver's types, though supported
    entry: archiver.EntryData & { store?: boolean; type?: "directory" }
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

/** Passes content through, counting its bytes and computing its SHA-256 */
function measureContent(onBytes: (count: number) => void) {
    const hash = crypto.createHash("sha256");
    let sizeBytes = 0;
    const stream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            hash.update(chunk);
            sizeBytes += chunk.length;
            onBytes(chunk.length);
            callback(null, chunk);
        }
    });
    return {
        stream,
        /** Only valid once the stream has ended */
        result: (): ContentMeasurement => ({
            sizeBytes,
            sha256: hash.digest("hex")
        })
    };
}

interface ContentMeasurement {
    sizeBytes: number;
    sha256: string;
}

function toJsonBuffer(value: unknown) {
    return Buffer.from(JSON.stringify(value, null, 2));
}

function toCollectionMetadata(
    collection: Collection,
    files: ReturnType<typeof toFileMetadata>[]
) {
    return {
        id: collection.id,
        name: collection.name,
        description: collection.description ?? null,
        createdAt: toIsoString(collection.createdAt),
        updatedAt: toIsoString(collection.updatedAt),
        tags: toTagNames(collection.Tags),
        files
    };
}

function toFileMetadata(
    file: CollectionFile,
    backupPath: string,
    { sizeBytes, sha256 }: ContentMeasurement
) {
    return {
        id: file.id,
        name: file.name,
        backupPath,
        status: "included",
        mimeType: file.mimeType,
        sizeBytes,
        sha256,
        width: file.width ?? null,
        height: file.height ?? null,
        thumbnailWidth: file.thumbnailWidth ?? null,
        thumbnailHeight: file.thumbnailHeight ?? null,
        takenAt: toIsoString(file.takenAt),
        durationInSeconds: file.durationInSeconds ?? null,
        // Postgres returns DECIMAL as a string
        gpsLatitude: toNumberOrNull(file.gpsLatitude),
        gpsLongitude: toNumberOrNull(file.gpsLongitude),
        gpsAltitude: toNumberOrNull(file.gpsAltitude),
        gpsLabel: file.gpsLabel ?? null,
        blurDataUrl: file.blurDataUrl ?? null,
        tags: toTagNames(file.Tags),
        createdAt: toIsoString(file.createdAt),
        updatedAt: toIsoString(file.updatedAt)
    };
}

function toIsoString(date: Date | null | undefined) {
    return date ? date.toISOString() : null;
}

function toNumberOrNull(value: number | string | null | undefined) {
    return value === null || value === undefined ? null : Number(value);
}

function toTagNames(tags: Tag[] | undefined) {
    return (tags ?? []).map((tag) => tag.name).sort();
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

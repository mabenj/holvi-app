import Database from "@/db/Database";
import { RestoreJob } from "@/db/models/RestoreJob";
import crypto from "crypto";
import { createWriteStream } from "fs";
import { mkdir, open, readdir, rename, rm, stat, statfs } from "fs/promises";
import path from "path";
import { InferAttributes, Op, Transaction } from "sequelize";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import appConfig from "../common/app-config";
import Cryptography from "../common/cryptography";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import Log, { LogColor } from "../common/log";
import { formatBytes, getErrorMessage, isUuidv4 } from "../common/utilities";
import { ZipReader } from "../common/zip-reader";
import {
    BackupContents,
    IncludedFile,
    readBackup,
    readTakenAt,
    withBackup
} from "./backup-reader";
import {
    JobRunner,
    JobRunnerOptions,
    ProgressSaver,
    throwIfAborted
} from "./job-runner";
import { ThumbnailResult, ThumbnailService } from "./thumbnail.service";
import { VideoProcessingService } from "./video-processing.service";
import { isCompletedBackupJobStatus } from "../types/backup-job-dto";
import {
    RestoreInspection,
    RestoreJobDto,
    RestoreJobStatus,
    RestoreSourceDto,
    RestoreSources,
    RestoreSummary,
    UnrestoredFile
} from "../types/restore-job-dto";

const CURRENT_BACKUP_SOURCE_ID = "current";
const MEBIBYTE = 1_024 * 1_024;
/** Each encrypted file starts with its IV */
const ENCRYPTION_OVERHEAD_BYTES = 16;
/** Room for each restored file's thumbnail, which the thumbnail worker makes afterwards */
const THUMBNAIL_MARGIN_BYTES = 256 * 1_024;
/** Required beyond the restored files and their thumbnails, for other writers on the volume */
const FREE_SPACE_MARGIN_BYTES = 100 * MEBIBYTE;
/** Files copied at once: enough to overlap hashing, encrypting and writing, few enough to keep reading the zip close to sequential */
const COPY_CONCURRENCY = 4;
/** Rows per insert statement when the restored library is inserted */
const INSERT_BATCH_SIZE = 1_000;

/** One file of a Backup being copied into storage */
export interface RestoreEntryRef {
    userId: string;
    collectionId: string;
    fileId: string;
    name: string;
}

/**
 * Passes one file's content on its way from the zip into storage. The real one
 * passes it through unchanged; tests hold it partway through or alter its bytes.
 * Failures must be emitted as stream errors.
 */
export type EntryCopy = (entry: RestoreEntryRef, content: Readable) => Readable;

/** Free space in bytes on the volume holding a directory */
export type FreeSpaceCheck = (dir: string) => Promise<number>;

interface RestoreServiceOptions {
    getFreeSpace?: FreeSpaceCheck;
    copyEntry?: EntryCopy;
}

/** The file system a job works with: the real one unless a test injected replacements */
interface RestoreJobDependencies {
    getFreeSpace: FreeSpaceCheck;
    copyEntry: EntryCopy;
}

/** A source resolved to its zip on disk */
interface ResolvedSource {
    dto: RestoreSourceDto;
    zipPath: string;
}

/** The part of a running job's progress that changes while files are copied */
interface CopyProgress {
    collectionsDone: number;
    filesDone: number;
    bytesDone: number;
    currentFileName: string | null;
}

type RestoreJobFields = Partial<InferAttributes<RestoreJob>>;

/**
 * Thumbnails a job has the thumbnail worker make as soon as each file is in
 * storage, before its row exists, so most are ready when the job completes.
 */
class EarlyThumbnails {
    private readonly made = new Map<string, ThumbnailResult>();
    private readonly making = new Set<Promise<void>>();

    constructor(private readonly userId: string) {}

    /** Stops handing files over once `signal` aborts */
    handOver({ collectionId, metadata }: IncludedFile, signal: AbortSignal) {
        const making: Promise<void> = ThumbnailService.makeEarly(
            {
                id: metadata.id,
                collectionId,
                userId: this.userId,
                mimeType: metadata.mimeType
            },
            signal
        )
            .then((result) => {
                if (result) {
                    this.made.set(metadata.id, result);
                }
            })
            .finally(() => this.making.delete(making));
        this.making.add(making);
    }

    /** The file's thumbnail if it has been made already */
    get(fileId: string) {
        return this.made.get(fileId);
    }

    /** Resolves once no thumbnail is being made, so a job deletes its files only after */
    async settle() {
        await Promise.all(this.making);
    }
}

const logger = new Log("RESTORE", LogColor.MAGENTA);

/**
 * Restores for one user: the Backups they can restore from, and Restore jobs
 * that bring a Backup's collections and files back into their account while
 * it has no collections.
 */
export class RestoreService {
    private readonly dependencies: RestoreJobDependencies;

    constructor(
        private readonly userId: string,
        options: RestoreServiceOptions = {}
    ) {
        this.dependencies = {
            getFreeSpace: options.getFreeSpace ?? realDependencies.getFreeSpace,
            copyEntry: options.copyEntry ?? realDependencies.copyEntry
        };
    }

    /** The zips in the user's own folder in the restore directory, and their Current backup if its zip still exists */
    async listSources(): Promise<RestoreSources> {
        const folder = await this.getUserFolder();
        const sources = (await this.findSources(folder)).map(({ dto }) => dto);
        const folderExists = await stat(folder)
            .then((stats) => stats.isDirectory())
            .catch(() => false);
        const db = await Database.getInstance();
        const unavailableReason = await checkNoCollections(this.userId, db)
            .then(() => null)
            .catch((error: Error) => error.message);
        const folderName = path.basename(folder);
        return {
            sources,
            folderName,
            hint: folderExists
                ? null
                : `Your folder for Backups does not exist yet. Ask the operator of this Holvi instance to place your Backup zip in a folder named '${folderName}' in the restore directory.`,
            unavailableReason
        };
    }

    /** A source's Manifest summary, or why it cannot be restored */
    async inspect(sourceId: string): Promise<RestoreInspection> {
        const source = await this.resolveSource(sourceId);
        try {
            const backup = await readBackup(source.zipPath);
            await checkFreeSpace(backup, this.dependencies.getFreeSpace);
            const db = await Database.getInstance();
            await checkAccountCanTake(this.userId, backup, db);
            return {
                source: source.dto,
                summary: toSummary(backup),
                reason: null
            };
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                return { source: source.dto, summary: null, reason: error.message };
            }
            throw error;
        }
    }

    /**
     * Queues a Restore job from one of the user's sources and returns it
     * immediately. Refuses, with the reason and without creating a job, if the
     * source cannot be restored into the account.
     */
    async start(sourceId: string): Promise<RestoreJobDto> {
        const source = await this.resolveSource(sourceId);
        const backup = await readBackup(source.zipPath);
        await checkFreeSpace(backup, this.dependencies.getFreeSpace);
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        let job: RestoreJob;
        try {
            // The lock Backup job starts take too, so neither can start while the other is starting
            await db.models.RestoreJob.sequelize!.query(
                "SELECT pg_advisory_xact_lock(hashtext(:userId))",
                { replacements: { userId: this.userId }, transaction }
            );
            const activeRestore = await db.models.RestoreJob.findOne({
                where: { UserId: this.userId, status: ["queued", "running"] },
                transaction
            });
            if (activeRestore) {
                throw new InvalidArgumentError(
                    "You already have a Restore job queued or running"
                );
            }
            const activeBackup = await db.models.BackupJob.findOne({
                where: { UserId: this.userId, status: ["queued", "running"] },
                transaction
            });
            if (activeBackup) {
                throw new InvalidArgumentError(
                    "A Restore cannot start while your Backup job is queued or running"
                );
            }
            await checkAccountCanTake(this.userId, backup, db, transaction);
            job = await db.models.RestoreJob.create(
                {
                    UserId: this.userId,
                    status: "queued",
                    queuedAt: new Date(),
                    sourceId: source.dto.id,
                    sourceName: source.dto.fileName,
                    zipPath: source.zipPath,
                    zipSizeBytes: backup.zipSizeBytes,
                    zipModifiedAt: backup.zipModifiedAt,
                    collectionIds: backup.collections.map(({ id }) => id)
                },
                { transaction }
            );
            getRunner().setDependencies(job.id, this.dependencies);
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        getRunner().kick();
        return job.toDto();
    }

    /**
     * Run once on server start: continues Restore jobs a previous process
     * left running, then starts queued jobs in order. Resolves once recovery is done.
     */
    static recover(): Promise<void> {
        return getRunner().recover();
    }

    /** The user's Restore jobs, latest first */
    async getJobs(): Promise<RestoreJobDto[]> {
        const db = await Database.getInstance();
        const jobs = await db.models.RestoreJob.findAll({
            where: { UserId: this.userId },
            order: [["queuedAt", "DESC"]]
        });
        return jobs.map((job) => job.toDto());
    }

    /** The user's queued or running Restore job, if any; a user has at most one */
    async getActiveJob(): Promise<RestoreJobDto | null> {
        const db = await Database.getInstance();
        const job = await db.models.RestoreJob.findOne({
            where: { UserId: this.userId, status: ["queued", "running"] }
        });
        return job?.toDto() ?? null;
    }

    async getJob(jobId: string): Promise<RestoreJobDto> {
        const job = await this.findUserJob(jobId);
        return job.toDto();
    }

    /**
     * Cancels a queued job, or stops a running one, waiting until it has
     * stopped and deleted every file it wrote. A finished job is returned unchanged.
     */
    async cancel(jobId: string): Promise<RestoreJobDto> {
        const job = await this.findUserJob(jobId);
        const db = await Database.getInstance();
        if (job.status === "queued") {
            // Conditional, so a job the runner claims meanwhile is stopped below instead
            const [cancelled] = await db.models.RestoreJob.update(
                { status: "cancelled", finishedAt: new Date() },
                { where: { id: job.id, status: "queued" } }
            );
            // A job resumed after a restart is queued with the files it already wrote
            if (cancelled > 0) {
                await removeWrittenFiles(job.UserId, job.collectionIds);
            }
        }
        const stopped = await getRunner().cancel(job.id);
        if (!stopped) {
            // Running but not in this process: left over from before a restart, not yet recovered
            const [cancelled] = await db.models.RestoreJob.update(
                { status: "cancelled", finishedAt: new Date(), currentFileName: null },
                { where: { id: job.id, status: "running" } }
            );
            if (cancelled > 0) {
                await removeWrittenFiles(job.UserId, job.collectionIds);
            }
        }
        return (await this.findUserJob(jobId)).toDto();
    }

    private async findUserJob(jobId: string) {
        const db = await Database.getInstance();
        const job = isUuidv4(jobId)
            ? await db.models.RestoreJob.findOne({
                  where: { id: jobId, UserId: this.userId }
              })
            : null;
        if (!job) {
            throw new NotFoundError(`Restore job '${jobId}' not found`);
        }
        return job;
    }

    private async getUserFolder() {
        const db = await Database.getInstance();
        const user = await db.models.User.findByPk(this.userId, {
            rejectOnEmpty: true
        });
        // Usernames are letters, digits and underscores, so safe as a folder name
        return path.join(appConfig.restoreDir, user.username);
    }

    private async findSources(folder: string): Promise<ResolvedSource[]> {
        const sources: ResolvedSource[] = [];
        const current = await this.findCurrentBackup();
        if (current) {
            sources.push(current);
        }
        const entries = await readdir(folder, { withFileTypes: true }).catch(
            () => []
        );
        const zipNames = entries
            .filter(
                (entry) =>
                    entry.isFile() && entry.name.toLowerCase().endsWith(".zip")
            )
            .map((entry) => entry.name)
            .sort();
        for (const fileName of zipNames) {
            const zipPath = path.join(folder, fileName);
            const stats = await stat(zipPath).catch(() => null);
            if (stats) {
                sources.push({
                    zipPath,
                    dto: {
                        id: fileName,
                        kind: "placed",
                        fileName,
                        sizeBytes: stats.size,
                        takenAt: (await readTakenAt(zipPath))?.getTime() ?? null
                    }
                });
            }
        }
        return sources;
    }

    private async findCurrentBackup(): Promise<ResolvedSource | null> {
        const db = await Database.getInstance();
        const jobs = await db.models.BackupJob.findAll({
            where: { UserId: this.userId, zipFileName: { [Op.ne]: null } }
        });
        const job = jobs.find((job) => isCompletedBackupJobStatus(job.status));
        if (!job?.zipFileName) {
            return null;
        }
        const zipPath = path.join(
            appConfig.backupDir,
            this.userId,
            job.zipFileName
        );
        const stats = await stat(zipPath).catch(() => null);
        if (!stats) {
            return null;
        }
        return {
            zipPath,
            dto: {
                id: CURRENT_BACKUP_SOURCE_ID,
                kind: "current",
                fileName: job.zipFileName,
                sizeBytes: stats.size,
                takenAt: (await readTakenAt(zipPath))?.getTime() ?? null
            }
        };
    }

    /** Only ever one of the sources listed for the user, so a source id never becomes a path of its own */
    private async resolveSource(sourceId: string) {
        const sources = await this.findSources(await this.getUserFolder());
        const source = sources.find(({ dto }) => dto.id === sourceId);
        if (!source) {
            throw new NotFoundError(`Restore source '${sourceId}' not found`);
        }
        return source;
    }
}

function copyEntryUnchanged(_entry: RestoreEntryRef, content: Readable) {
    return content;
}

async function getFreeSpaceFromFileSystem(dir: string) {
    const { bavail, bsize } = await statfs(dir);
    return bavail * bsize;
}

const realDependencies: RestoreJobDependencies = {
    getFreeSpace: getFreeSpaceFromFileSystem,
    copyEntry: copyEntryUnchanged
};

function toSummary({
    manifest,
    collections,
    zipSizeBytes
}: BackupContents): RestoreSummary {
    return {
        username: manifest.user.username,
        takenAt: new Date(manifest.snapshotAt).getTime(),
        formatVersion: manifest.formatVersion,
        collectionCount: collections.length,
        fileCount: manifest.totals.files,
        bytes: manifest.totals.bytes,
        zipSizeBytes,
        problems: manifest.problems
    };
}

/**
 * Refuses a Restore into an account that has collections, or of a Backup
 * whose collections or files still exist anywhere on the instance.
 */
async function checkAccountCanTake(
    userId: string,
    { collections }: BackupContents,
    db: Database,
    transaction?: Transaction
) {
    await checkNoCollections(userId, db, transaction);
    const collectionIds = collections.map(({ id }) => id);
    const fileIds = collections.flatMap(({ files }) => files.map(({ id }) => id));
    const existing =
        (await db.models.Collection.count({
            where: { id: collectionIds },
            transaction
        })) +
        (await db.models.CollectionFile.count({
            where: { id: fileIds },
            transaction
        }));
    if (existing > 0) {
        throw new InvalidArgumentError(
            "This Backup's content is still on this Holvi instance: some of its collections or files already exist"
        );
    }
}

async function checkNoCollections(
    userId: string,
    db: Database,
    transaction?: Transaction
) {
    const ownCollections = await db.models.Collection.count({
        where: { UserId: userId },
        transaction
    });
    if (ownCollections > 0) {
        throw new InvalidArgumentError(
            "Restore is only possible into an account with no collections"
        );
    }
}

/** Refuses a Restore whose files and their thumbnails would not fit on the data volume */
async function checkFreeSpace(
    { includedFiles }: BackupContents,
    getFreeSpace: FreeSpaceCheck
) {
    let needed = FREE_SPACE_MARGIN_BYTES;
    for (const { metadata } of includedFiles) {
        needed +=
            metadata.sizeBytes + ENCRYPTION_OVERHEAD_BYTES + THUMBNAIL_MARGIN_BYTES;
    }
    await mkdir(appConfig.dataDir, { recursive: true });
    const available = await getFreeSpace(appConfig.dataDir);
    if (available < needed) {
        throw new InvalidArgumentError(
            `Not enough free space for this Restore: about ${formatBytes(
                needed
            )} needed, ${formatBytes(available)} available`
        );
    }
}

/**
 * Job state is persisted with targeted updates rather than by saving a shared
 * model instance, so progress changed during an in-flight save is never lost.
 */
async function updateJob(jobId: string, fields: RestoreJobFields) {
    const db = await Database.getInstance();
    await db.models.RestoreJob.update(fields, { where: { id: jobId } });
}

const runnerOptions: JobRunnerOptions<RestoreJob, RestoreJobDependencies> = {
    kind: "restore",
    logger,
    realDependencies,
    findNextQueued: async () => {
        const db = await Database.getInstance();
        return db.models.RestoreJob.findOne({
            where: { status: "queued" },
            order: [
                ["queuedAt", "ASC"],
                ["createdAt", "ASC"]
            ]
        });
    },
    claim: async (jobId) => {
        const db = await Database.getInstance();
        const [claimed] = await db.models.RestoreJob.update(
            { status: "running" },
            { where: { id: jobId, status: "queued" } }
        );
        return claimed > 0;
    },
    run: (job, dependencies, signal) => runRestoreJob(job, dependencies, signal),
    recoverInterrupted: () => recoverInterruptedJobs()
};

declare global {
    // eslint-disable-next-line no-var
    var holviRestoreJobRunner:
        | JobRunner<RestoreJob, RestoreJobDependencies>
        | undefined;
}

/**
 * The instance's one Restore job runner, separate from the Backup job runner so
 * neither kind of job waits for the other. Kept on globalThis because Next.js
 * may load this module more than once (per API route bundle, instrumentation, hot reload).
 */
function getRunner() {
    globalThis.holviRestoreJobRunner ??= new JobRunner(runnerOptions);
    return globalThis.holviRestoreJobRunner;
}

/**
 * Queues jobs a previous server process left running again, keeping their
 * place at the front of the queue, so each continues where it left off: its
 * partial files are deleted and the files it renamed into place are kept.
 * A job whose source changed meanwhile fails once run, like any other.
 */
async function recoverInterruptedJobs() {
    const db = await Database.getInstance();
    const interrupted = await db.models.RestoreJob.findAll({
        where: { status: "running" }
    });
    for (const job of interrupted) {
        await removePartialFiles(job.UserId, job.collectionIds);
        await updateJob(job.id, { status: "queued", currentFileName: null });
    }
    logger.info(
        `Recovered Restore jobs: ${interrupted.length} interrupted jobs queued to continue`
    );
}

/** Deletes the files a job was writing when it stopped, which never passed their checks */
async function removePartialFiles(userId: string, collectionIds: string[]) {
    for (const collectionId of collectionIds) {
        const dir = path.join(appConfig.dataDir, userId, collectionId);
        const names = await readdir(dir).catch(() => []);
        for (const name of names.filter((name) => name.endsWith(".partial"))) {
            await rm(path.join(dir, name), { force: true });
        }
    }
}

/**
 * Deletes everything a job wrote: the directories of the Backup's
 * collections, which nothing else on the instance can have, since a Restore
 * starts only if none of its collections exist. Once the job's library is in
 * the database, its files are kept.
 */
async function removeWrittenFiles(userId: string, collectionIds: string[]) {
    if (await isLibraryInserted(userId, collectionIds)) {
        return;
    }
    for (const collectionId of collectionIds) {
        await rm(path.join(appConfig.dataDir, userId, collectionId), {
            recursive: true,
            force: true
        }).catch((error) =>
            logger.error(
                `Could not delete restored files of collection '${collectionId}'`,
                error
            )
        );
    }
}

/** Runs a job already marked running; aborting `signal` cancels it */
async function runRestoreJob(
    job: RestoreJob,
    dependencies: RestoreJobDependencies,
    signal: AbortSignal
) {
    const progress: CopyProgress = {
        collectionsDone: 0,
        filesDone: 0,
        bytesDone: 0,
        currentFileName: null
    };
    const progressSaver = new ProgressSaver(
        progress,
        (current) => updateJob(job.id, current),
        logger,
        `Restore job '${job.id}'`
    );
    const thumbnails = new EarlyThumbnails(job.UserId);
    // Set once the restored library is in the database, after which its files must stay
    let unrestoredFiles: UnrestoredFile[] | null = null;
    try {
        throwIfAborted(signal);
        if (await isLibraryInserted(job.UserId, job.collectionIds)) {
            // Interrupted by a restart after the insert, before being marked completed
            unrestoredFiles = job.unrestoredFiles;
            await finishCompletedJob(job.id, unrestoredFiles);
            return;
        }
        await checkSourceUnchanged(job);
        await withBackup(job.zipPath, async (backup, zip) => {
            await updateJob(job.id, {
                // A job continued after a restart keeps when it first started
                startedAt: job.startedAt ?? new Date(),
                collectionsTotal: backup.collections.length,
                filesTotal: backup.includedFiles.length,
                bytesTotal: backup.includedFiles.reduce(
                    (sum, { metadata }) => sum + metadata.sizeBytes,
                    0
                ),
                problems: backup.manifest.problems
            });
            logger.info(`Restore job '${job.id}' started`);
            progressSaver.start();
            const unrestored = await copyFiles(
                job.UserId,
                backup,
                zip,
                dependencies,
                progress,
                thumbnails,
                signal
            );
            await progressSaver.stop();
            throwIfAborted(signal);
            progress.currentFileName = null;
            // Saved before the insert, so a job interrupted right after it can still be completed
            await updateJob(job.id, { ...progress, unrestoredFiles: unrestored });
            await insertLibrary(job.UserId, backup, unrestored, thumbnails);
            unrestoredFiles = unrestored;
        });
        await finishCompletedJob(job.id, unrestoredFiles!);
    } catch (error) {
        await progressSaver.stop();
        if (unrestoredFiles) {
            // The library is in the account: the job completed, whatever failed after
            logger.error(`Could not finish Restore job '${job.id}'`, error);
            await finishCompletedJob(job.id, unrestoredFiles).catch(() => {});
            return;
        }
        // Thumbnails being made would otherwise land after their files are deleted
        await thumbnails.settle();
        await removeWrittenFiles(job.UserId, job.collectionIds);
        const cancelled = signal.aborted;
        if (cancelled) {
            logger.info(`Restore job '${job.id}' cancelled`);
        } else {
            logger.error(`Restore job '${job.id}' failed`, error);
        }
        await updateJob(job.id, {
            status: cancelled ? "cancelled" : "failed",
            finishedAt: new Date(),
            currentFileName: null,
            errorMessage: cancelled ? null : getErrorMessage(error)
        }).catch((updateError) =>
            logger.error(
                `Could not mark Restore job '${job.id}' ${
                    cancelled ? "cancelled" : "failed"
                }`,
                updateError
            )
        );
    }
}

/** Records a job whose library is in the account, and starts the background work its files need */
async function finishCompletedJob(
    jobId: string,
    unrestoredFiles: UnrestoredFile[]
) {
    // Not awaited: both carry on after the Restore job
    ThumbnailService.kick();
    VideoProcessingService.kick();
    const status: RestoreJobStatus =
        unrestoredFiles.length > 0 ? "completedWithErrors" : "completed";
    await updateJob(jobId, {
        status,
        finishedAt: new Date(),
        currentFileName: null,
        unrestoredFiles
    });
    logger.info(
        `Restore job '${jobId}' ${status} (${unrestoredFiles.length} unrestored files)`
    );
}

/** Whether the job's library is in the database: inserted all at once, and none of it existed when the job started */
async function isLibraryInserted(userId: string, collectionIds: string[]) {
    const db = await Database.getInstance();
    const inserted = await db.models.Collection.count({
        where: { id: collectionIds, UserId: userId }
    });
    return inserted > 0;
}

/** Fails the job if its zip is gone or changed since the job was queued, so a Restore never mixes two Backups */
async function checkSourceUnchanged(job: RestoreJob) {
    const stats = await stat(job.zipPath).catch(() => null);
    if (
        !stats ||
        stats.size !== job.zipSizeBytes ||
        stats.mtime.getTime() !== job.zipModifiedAt.getTime()
    ) {
        throw new Error(
            "The Backup changed or disappeared after the Restore job was queued"
        );
    }
}

/**
 * Copies every included file into storage, a few at a time in zip order, so
 * reading stays close to sequential while hashing, encrypting and writing
 * overlap. Returns the files whose content did not match, in zip order.
 */
async function copyFiles(
    userId: string,
    backup: BackupContents,
    zip: ZipReader,
    dependencies: RestoreJobDependencies,
    progress: CopyProgress,
    thumbnails: EarlyThumbnails,
    signal: AbortSignal
) {
    const remainingByCollection = new Map(
        backup.collections.map(({ id }) => [id, 0])
    );
    for (const { collectionId } of backup.includedFiles) {
        remainingByCollection.set(
            collectionId,
            remainingByCollection.get(collectionId)! + 1
        );
    }
    const countDoneCollections = () =>
        Array.from(remainingByCollection.values()).filter(
            (remaining) => remaining === 0
        ).length;
    progress.collectionsDone = countDoneCollections();

    // Also stops the other copies once one fails, so the job cleans up only after every copy has stopped
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort);
    if (signal.aborted) {
        abort();
    }
    const reasons = new Map<IncludedFile, string>();
    const copying = new Set<Promise<void>>();
    const failures: unknown[] = [];
    try {
        for (const file of backup.includedFiles) {
            if (controller.signal.aborted) {
                break;
            }
            progress.currentFileName = file.metadata.name;
            const copy: Promise<void> = copyFile(
                userId,
                file,
                zip,
                dependencies.copyEntry,
                (count) => (progress.bytesDone += count),
                controller.signal
            )
                .then((reason) => {
                    if (reason) {
                        reasons.set(file, reason);
                    } else {
                        thumbnails.handOver(file, controller.signal);
                    }
                    progress.filesDone += 1;
                    remainingByCollection.set(
                        file.collectionId,
                        remainingByCollection.get(file.collectionId)! - 1
                    );
                    progress.collectionsDone = countDoneCollections();
                })
                .catch((error) => {
                    failures.push(error);
                    controller.abort(error);
                })
                .finally(() => copying.delete(copy));
            copying.add(copy);
            if (copying.size >= COPY_CONCURRENCY) {
                await Promise.race(copying);
            }
        }
    } finally {
        await Promise.all(copying);
        signal.removeEventListener("abort", abort);
    }
    throwIfAborted(signal);
    if (failures.length > 0) {
        // The first; the others are copies it stopped
        throw failures[0];
    }
    return backup.includedFiles.flatMap((file) => {
        const reason = reasons.get(file);
        return reason
            ? [
                  {
                      fileId: file.metadata.id,
                      collectionId: file.collectionId,
                      name: file.metadata.name,
                      reason
                  }
              ]
            : [];
    });
}

/**
 * Hashes, measures and encrypts one file in a single pass into a partial file
 * next to its storage path, and renames it into place only if its checksum and
 * size match its metadata. Returns why it did not match, or null once it is in
 * place. Read and write failures fail the job.
 */
async function copyFile(
    userId: string,
    { collectionId, metadata, entry }: IncludedFile,
    zip: ZipReader,
    copyEntry: EntryCopy,
    onBytes: (count: number) => void,
    signal: AbortSignal
): Promise<string | null> {
    if (!entry) {
        return "The Backup has no content for this file";
    }
    const storedPath = path.join(appConfig.dataDir, userId, collectionId, metadata.id);
    if (await exists(storedPath)) {
        // Renamed into place, so checked, before the job was interrupted by a restart
        onBytes(metadata.sizeBytes);
        return null;
    }
    const partialPath = `${storedPath}.partial`;
    await mkdir(path.dirname(storedPath), { recursive: true });
    const hash = crypto.createHash("sha256");
    let sizeBytes = 0;
    const measure = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            hash.update(chunk);
            sizeBytes += chunk.length;
            onBytes(chunk.length);
            callback(null, chunk);
        }
    });
    try {
        const content = copyEntry(
            {
                userId,
                collectionId,
                fileId: metadata.id,
                name: metadata.name
            },
            await zip.openStoredEntry(entry)
        );
        await pipeline(
            content,
            measure,
            Cryptography.createEncryptionStream(),
            createWriteStream(partialPath, { flags: "wx" }),
            { signal }
        );
        const sha256 = hash.digest("hex");
        const reason =
            sizeBytes !== metadata.sizeBytes
                ? `Its content is ${sizeBytes} bytes, but its metadata records ${metadata.sizeBytes}`
                : sha256 !== metadata.sha256
                ? "Its content does not match the checksum its metadata records"
                : null;
        if (reason) {
            await rm(partialPath, { force: true });
            return reason;
        }
        await flushToDisk(partialPath);
        await rename(partialPath, storedPath);
        return null;
    } catch (error) {
        await rm(partialPath, { force: true });
        throw error;
    }
}

function exists(filePath: string) {
    return stat(filePath).then(
        () => true,
        () => false
    );
}

async function flushToDisk(filePath: string) {
    const handle = await open(filePath, "r+");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

/**
 * Inserts every collection, restored file, tag and link in one transaction,
 * with their original ids and timestamps, so the whole library appears at
 * once. Chosen covers that are not one of the collection's own restored files
 * are cleared. Files whose thumbnail was made during the job are inserted with it.
 */
async function insertLibrary(
    userId: string,
    { collections, includedFiles }: BackupContents,
    unrestored: UnrestoredFile[],
    thumbnails: EarlyThumbnails
) {
    const unrestoredIds = new Set(unrestored.map(({ fileId }) => fileId));
    const restoredFiles = includedFiles.filter(
        ({ metadata }) => !unrestoredIds.has(metadata.id)
    );
    const restoredCollectionIds = new Map(
        restoredFiles.map(({ collectionId, metadata }) => [metadata.id, collectionId])
    );
    const db = await Database.getInstance();
    const transaction = await db.transaction();
    try {
        const insert = async <T>(
            rows: T[],
            create: (batch: T[]) => Promise<unknown>
        ) => {
            for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
                await create(rows.slice(i, i + INSERT_BATCH_SIZE));
            }
        };
        const options = { transaction, returning: false, ignoreDuplicates: true };

        await insert(collections, (batch) =>
            db.models.Collection.bulkCreate(
                batch.map((collection) => ({
                    id: collection.id,
                    name: collection.name,
                    description: collection.description,
                    createdAt: new Date(collection.createdAt),
                    updatedAt: new Date(collection.updatedAt),
                    coverFileId:
                        collection.coverFileId &&
                        restoredCollectionIds.get(collection.coverFileId) ===
                            collection.id
                            ? collection.coverFileId
                            : null,
                    openCount: collection.openCount,
                    lastOpened: toDateOrNull(collection.lastOpened),
                    UserId: userId
                })),
                { transaction, returning: false }
            )
        );
        await insert(restoredFiles, (batch) =>
            db.models.CollectionFile.bulkCreate(
                batch.map(({ collectionId, metadata }) => ({
                    id: metadata.id,
                    name: metadata.name,
                    mimeType: metadata.mimeType,
                    width: metadata.width,
                    height: metadata.height,
                    thumbnailWidth: metadata.thumbnailWidth,
                    thumbnailHeight: metadata.thumbnailHeight,
                    // Made again, during the job or by the thumbnail worker afterwards; the blur placeholder shows meanwhile
                    thumbnailStatus: "pending" as const,
                    ...thumbnails.get(metadata.id),
                    takenAt: toDateOrNull(metadata.takenAt),
                    durationInSeconds: metadata.durationInSeconds,
                    gpsLatitude: metadata.gpsLatitude,
                    gpsLongitude: metadata.gpsLongitude,
                    gpsAltitude: metadata.gpsAltitude,
                    gpsLabel: metadata.gpsLabel,
                    blurDataUrl: metadata.blurDataUrl,
                    // Video processing gives every video its Scrub preview, and a Rendition if needed
                    processingStatus: metadata.mimeType.startsWith("video")
                        ? "pending"
                        : null,
                    createdAt: new Date(metadata.createdAt),
                    updatedAt: new Date(metadata.updatedAt),
                    CollectionId: collectionId
                })),
                { transaction, returning: false }
            )
        );

        const tagNames = new Set<string>();
        collections.forEach(({ tags }) => tags.forEach((tag) => tagNames.add(tag)));
        restoredFiles.forEach(({ metadata }) =>
            metadata.tags.forEach((tag) => tagNames.add(tag))
        );
        // Tags are case-insensitive, so ones the user already has are merged
        await insert(Array.from(tagNames), (batch) =>
            db.models.Tag.bulkCreate(
                batch.map((name) => ({ name })),
                options
            )
        );
        await insert(
            collections.flatMap(({ id, tags }) =>
                tags.map((TagName) => ({ CollectionId: id, TagName }))
            ),
            (batch) => db.models.CollectionTag.bulkCreate(batch, options)
        );
        await insert(
            restoredFiles.flatMap(({ metadata }) =>
                metadata.tags.map((TagName) => ({
                    CollectionFileId: metadata.id,
                    TagName
                }))
            ),
            (batch) => db.models.CollectionFileTag.bulkCreate(batch, options)
        );
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

function toDateOrNull(value: string | null) {
    return value === null ? null : new Date(value);
}

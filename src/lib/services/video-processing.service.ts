import Database from "@/db/Database";
import { CollectionFile } from "@/db/models/CollectionFile";
import { createWriteStream } from "fs";
import { mkdir, rename, rm, rmdir } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import appConfig from "../common/app-config";
import Cryptography from "../common/cryptography";
import Log, { LogColor } from "../common/log";
import { UserFileSystem } from "../common/user-file-system";
import { getErrorMessage } from "../common/utilities";
import { planRendition, VideoHelper } from "../common/video-helper";
import {
    FailedVideo,
    VideoProcessingStatus
} from "../types/video-processing-status";

export type {
    FailedVideo,
    VideoProcessingStatus
} from "../types/video-processing-status";

export interface VideoFileRef {
    userId: string;
    collectionId: string;
    fileId: string;
}

/** Opens a video's whole decrypted original. Failures must be emitted as stream errors. */
export type DecryptedVideoOpener = (file: VideoFileRef) => Readable;

interface VideoProcessingServiceOptions {
    openDecryptedFile?: DecryptedVideoOpener;
}

/** The file system the worker uses for one user's videos: the real one unless a test injected replacements */
interface WorkerDependencies {
    openDecryptedFile: DecryptedVideoOpener;
}

const realDependencies: WorkerDependencies = {
    openDecryptedFile: ({ userId, collectionId, fileId }) =>
        new UserFileSystem(userId).openDecryptedFile(collectionId, fileId)
};

/** Where the worker stages a video's plaintext while processing it; only ever holds the video in progress */
const PROCESSING_DIR_NAME = "processing";

/** How often the worker checks again whether the Backup job it waits for has finished */
const BACKUP_CHECK_INTERVAL_MS = 2_000;

const logger = new Log("VIDEO", LogColor.CYAN);

/**
 * Video processing for one user: queues their videos, and reports how far the
 * instance's one worker has got with them. The worker gives every video a
 * Scrub preview, and a Rendition if its original is not web-safe, and never
 * modifies the original.
 */
export class VideoProcessingService {
    /** Null for the real file system */
    private readonly dependencies: WorkerDependencies | null;

    constructor(
        private readonly userId: string,
        options: VideoProcessingServiceOptions = {}
    ) {
        this.dependencies = options.openDecryptedFile
            ? { openDecryptedFile: options.openDecryptedFile }
            : null;
    }

    /**
     * Marks the user's videos that were never processed, or whose processing
     * failed, as pending, and starts the worker. Returns the status as queued.
     */
    async processVideos(): Promise<VideoProcessingStatus> {
        const db = await Database.getInstance();
        getWorker().setDependencies(this.userId, this.dependencies);
        await db.models.CollectionFile.sequelize!.query(
            `UPDATE "CollectionFiles" f
                SET "processingStatus" = 'pending', "processingError" = NULL
                FROM "Collections" c
                WHERE c.id = f."CollectionId" AND c."UserId" = :userId
                    AND f."mimeType" LIKE 'video%'
                    AND (f."processingStatus" IS NULL OR f."processingStatus" = 'failed')`,
            { replacements: { userId: this.userId } }
        );
        const status = await this.getStatus();
        getWorker().kick();
        return status;
    }

    /** How many of the user's videos are in each processing status, and which one is being processed */
    async getStatus(): Promise<VideoProcessingStatus> {
        const db = await Database.getInstance();
        const counts = (await db.select(
            `SELECT f."processingStatus" AS status, COUNT(*)::int AS count
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE c."UserId" = :userId AND f."processingStatus" IS NOT NULL
                GROUP BY f."processingStatus"`,
            { userId: this.userId }
        )) as { status: string; count: number }[];
        const countOf = (status: string) =>
            counts.find((row) => row.status === status)?.count ?? 0;
        const [current] = (await db.select(
            `SELECT f.id, f."CollectionId" AS "collectionId", f.name
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE c."UserId" = :userId AND f."processingStatus" = 'processing'
                LIMIT 1`,
            { userId: this.userId }
        )) as { id: string; collectionId: string; name: string }[];
        return {
            pending: countOf("pending"),
            processing: countOf("processing"),
            done: countOf("done"),
            failed: countOf("failed"),
            currentFile: current ?? null
        };
    }

    /** The user's videos whose processing failed, oldest first, with the error each failed with */
    async getFailedVideos(): Promise<FailedVideo[]> {
        const db = await Database.getInstance();
        return (await db.select(
            `SELECT f.id, f."CollectionId" AS "collectionId", f.name,
                    f."processingError" AS error
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE c."UserId" = :userId AND f."processingStatus" = 'failed'
                ORDER BY f."createdAt", f.id`,
            { userId: this.userId }
        )) as FailedVideo[];
    }

    /** Starts the worker on videos already pending, such as uploads just stored */
    static kick() {
        getWorker().kick();
    }

    /**
     * Run once on server start: returns videos a previous process left
     * processing to pending, empties the processing directory and starts the
     * worker. Resolves once recovery is done.
     */
    static recover(): Promise<void> {
        return getWorker().recover();
    }
}

/** Processes pending videos one at a time across the whole instance, oldest first */
class VideoProcessingWorker {
    private draining = false;
    private queueChanged = false;
    private waitingForBackup = false;
    private recoveryRequests: {
        resolve: () => void;
        reject: (error: unknown) => void;
    }[] = [];
    /** Dependencies injected by the service that queued each user's videos; others use the real file system */
    private readonly dependencies = new Map<string, WorkerDependencies>();

    /** Null goes back to the real file system */
    setDependencies(userId: string, dependencies: WorkerDependencies | null) {
        if (dependencies) {
            this.dependencies.set(userId, dependencies);
        } else {
            this.dependencies.delete(userId);
        }
    }

    /**
     * Recovers from a previous server process once no video of this worker is
     * being processed, then goes on to process pending videos. Resolves once
     * recovery is done.
     */
    recover() {
        const recovered = new Promise<void>((resolve, reject) =>
            this.recoveryRequests.push({ resolve, reject })
        );
        this.kick();
        return recovered;
    }

    kick() {
        this.queueChanged = true;
        if (this.draining) {
            return;
        }
        this.draining = true;
        void this.drain();
    }

    private async drain() {
        try {
            // A video queued while the last lookup was in flight must not be missed
            while (this.queueChanged) {
                this.queueChanged = false;
                while (await this.processNextVideo()) {}
            }
        } catch (error) {
            logger.error("Video processing stopped", error);
        } finally {
            // Synchronous with the last check above, so no kick is lost
            this.draining = false;
        }
    }

    /** Claims and processes the oldest pending video; returns false if none is pending */
    private async processNextVideo() {
        // Between videos, so recovery never touches a video this process is processing
        await this.runRequestedRecovery();
        const db = await Database.getInstance();
        const [next] = (await db.select(
            `SELECT f.id, f."CollectionId" AS "collectionId", c."UserId" AS "userId"
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE f."processingStatus" = 'pending'
                ORDER BY f."createdAt", f.id
                LIMIT 1`
        )) as { id: string; collectionId: string; userId: string }[];
        if (!next) {
            return false;
        }
        if (await isBackupJobActive()) {
            // Backups need the disk and CPU more; check again after a while
            if (!this.waitingForBackup) {
                logger.info("Waiting for the Backup job to finish");
                this.waitingForBackup = true;
            }
            await sleep(BACKUP_CHECK_INTERVAL_MS);
            return true;
        }
        this.waitingForBackup = false;
        // Conditional, so another instance's worker cannot process it too
        const [claimed] = await db.models.CollectionFile.update(
            { processingStatus: "processing" },
            { where: { id: next.id, processingStatus: "pending" } }
        );
        if (claimed > 0) {
            const ref = {
                userId: next.userId,
                collectionId: next.collectionId,
                fileId: next.id
            };
            await processVideo(
                ref,
                this.dependencies.get(next.userId) ?? realDependencies
            );
        }
        return true;
    }

    private async runRequestedRecovery() {
        const requests = this.recoveryRequests.splice(0);
        if (requests.length === 0) {
            return;
        }
        try {
            await recoverInterruptedVideos();
            requests.forEach((request) => request.resolve());
        } catch (error) {
            logger.error("Could not recover video processing", error);
            requests.forEach((request) => request.reject(error));
        }
    }
}

/** Returns videos a previous server process left processing to pending, and deletes the plaintext it staged */
async function recoverInterruptedVideos() {
    const db = await Database.getInstance();
    const [requeuedCount] = await db.models.CollectionFile.update(
        { processingStatus: "pending" },
        { where: { processingStatus: "processing" } }
    );
    const processingDir = path.join(appConfig.dataDir, PROCESSING_DIR_NAME);
    await rm(processingDir, { recursive: true, force: true });
    logger.info(
        `Recovered video processing: ${requeuedCount} interrupted videos pending again, processing directory emptied`
    );
}

/**
 * Decrypts the original to a temporary file in the data directory, gives it a
 * Rendition if it is not web-safe and a Scrub preview, encrypts them and moves
 * them next to the original, records the result and deletes the temporary
 * plaintext.
 */
async function processVideo(
    ref: VideoFileRef,
    dependencies: WorkerDependencies
) {
    const workDir = path.join(
        appConfig.dataDir,
        PROCESSING_DIR_NAME,
        ref.fileId
    );
    const fileSystem = new UserFileSystem(ref.userId);
    const renditionPath = fileSystem.getRenditionPath(
        ref.collectionId,
        ref.fileId
    );
    const scrubPreviewPath = fileSystem.getScrubPreviewPath(
        ref.collectionId,
        ref.fileId
    );
    // Neither is worth keeping unless the result is recorded. A video deleted
    // while it was processed may have taken its collection's directory with
    // it, which storing the outputs made again: those directories go too once
    // they are empty.
    const deleteOutputs = async () => {
        await Promise.all([
            rm(renditionPath, { force: true }),
            rm(scrubPreviewPath, { force: true })
        ]);
        const collectionDir = path.dirname(path.dirname(renditionPath));
        for (const dir of [
            path.dirname(renditionPath),
            path.dirname(scrubPreviewPath),
            collectionDir
        ]) {
            // Fails, and so keeps the directory, unless it is empty
            await rmdir(dir).catch(() => {});
        }
    };
    let storedRendition = false;
    try {
        await rm(workDir, { recursive: true, force: true });
        await mkdir(workDir, { recursive: true });
        const originalPath = path.join(workDir, "original");
        await pipeline(
            dependencies.openDecryptedFile(ref),
            createWriteStream(originalPath)
        );
        const { codecs, captureDate } = await VideoHelper.probe(originalPath);
        const plan = planRendition(codecs);
        if (plan) {
            const outputPath = path.join(workDir, "rendition.mp4");
            await VideoHelper.produceRendition(
                originalPath,
                outputPath,
                plan,
                codecs,
                appConfig.renditionMaxBitrateKbps
            );
            await storeEncrypted(outputPath, renditionPath);
            storedRendition = true;
        } else {
            // A Rendition left from an earlier run would no longer match
            await rm(renditionPath, { force: true });
        }
        const scrubPreviewOutput = path.join(workDir, "scrub-preview.jpg");
        const scrubPreviewLayout = await VideoHelper.produceScrubPreview(
            originalPath,
            workDir,
            scrubPreviewOutput
        );
        await storeEncrypted(scrubPreviewOutput, scrubPreviewPath);
        const recorded = await recordResult(ref.fileId, {
            processingStatus: "done",
            processingError: null,
            hasRendition: storedRendition,
            scrubPreviewLayout,
            // The file's own record of when it was shot beats the upload's last-modified time
            ...(captureDate ? { takenAt: captureDate } : {})
        });
        if (!recorded) {
            // Deleted while it was being processed
            await deleteOutputs();
        }
        const outcome =
            plan === "remux"
                ? "remuxed to a Rendition"
                : plan === "transcode"
                ? "transcoded to a Rendition"
                : "web-safe, no Rendition";
        logger.info(
            `Processed video '${ref.fileId}' (${outcome}, Scrub preview of ${scrubPreviewLayout.frames} frames)`
        );
    } catch (error) {
        logger.error(`Could not process video '${ref.fileId}'`, error);
        // A Rendition, stored now or by an earlier run, keeps a video that is
        // not web-safe playable even though its processing failed
        await rm(scrubPreviewPath, { force: true }).catch(() => {});
        const recorded = await recordResult(ref.fileId, {
            processingStatus: "failed",
            processingError: getErrorMessage(error),
            scrubPreviewLayout: null,
            ...(storedRendition ? { hasRendition: true } : {})
        }).catch((updateError) => {
            logger.error(
                `Could not mark video '${ref.fileId}' failed`,
                updateError
            );
            return true;
        });
        if (!recorded) {
            // Deleted while it was being processed
            await deleteOutputs().catch(() => {});
        }
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch((error) =>
            logger.error(`Could not delete '${workDir}'`, error)
        );
    }
}

/** Whether any Backup job on the instance is queued or running */
async function isBackupJobActive() {
    const db = await Database.getInstance();
    const activeJob = await db.models.BackupJob.findOne({
        attributes: ["id"],
        where: { status: ["queued", "running"] }
    });
    return activeJob !== null;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Encrypts an output of video processing and moves it to where it is stored.
 * Encrypted before it leaves the processing directory, so no plaintext lands
 * next to the original.
 */
async function storeEncrypted(outputPath: string, storedPath: string) {
    await Cryptography.encryptFile(outputPath);
    await mkdir(path.dirname(storedPath), { recursive: true });
    await rename(outputPath, storedPath);
}

/** Records a processed video's result; false if it no longer exists or is no longer being processed */
async function recordResult(
    fileId: string,
    fields: Pick<
        CollectionFile,
        "processingStatus" | "processingError" | "scrubPreviewLayout"
    > &
        Partial<Pick<CollectionFile, "hasRendition" | "takenAt">>
) {
    const db = await Database.getInstance();
    const [updated] = await db.models.CollectionFile.update(fields, {
        where: { id: fileId, processingStatus: "processing" }
    });
    return updated > 0;
}

declare global {
    // eslint-disable-next-line no-var
    var holviVideoProcessingWorker: VideoProcessingWorker | undefined;
}

/**
 * The instance's one worker. Kept on globalThis because Next.js may load this
 * module more than once (per API route bundle, instrumentation, hot reload).
 */
function getWorker() {
    globalThis.holviVideoProcessingWorker ??= new VideoProcessingWorker();
    return globalThis.holviVideoProcessingWorker;
}

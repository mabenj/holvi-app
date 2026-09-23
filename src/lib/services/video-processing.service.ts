import Database from "@/db/Database";
import { CollectionFile } from "@/db/models/CollectionFile";
import { createWriteStream } from "fs";
import { mkdir, rename, rm } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import appConfig from "../common/app-config";
import Cryptography from "../common/cryptography";
import Log, { LogColor } from "../common/log";
import { UserFileSystem } from "../common/user-file-system";
import { getErrorMessage } from "../common/utilities";
import { planRendition, VideoHelper } from "../common/video-helper";
import { VideoProcessingStatus } from "../types/video-processing-status";

export type { VideoProcessingStatus } from "../types/video-processing-status";

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

const logger = new Log("VIDEO", LogColor.CYAN);

/**
 * Video processing for one user: queues their videos, and reports how far the
 * instance's one worker has got with them. The worker gives every video whose
 * original is not web-safe a Rendition, and never modifies the original.
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

    /** Starts the worker on videos already pending, such as uploads just stored */
    static kick() {
        getWorker().kick();
    }
}

/** Processes pending videos one at a time across the whole instance, oldest first */
class VideoProcessingWorker {
    private draining = false;
    private queueChanged = false;
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
        // Conditional, so another instance's worker cannot process it too
        const [claimed] = await db.models.CollectionFile.update(
            { processingStatus: "processing" },
            { where: { id: next.id, processingStatus: "pending" } }
        );
        if (claimed > 0) {
            await processVideo(
                { userId: next.userId, collectionId: next.collectionId, fileId: next.id },
                this.dependencies.get(next.userId) ?? realDependencies
            );
        }
        return true;
    }
}

/**
 * Decrypts the original to a temporary file in the data directory, gives it a
 * Rendition if it is not web-safe, encrypts the Rendition and moves it next to
 * the original, records the result and deletes the temporary plaintext.
 */
async function processVideo(ref: VideoFileRef, dependencies: WorkerDependencies) {
    const workDir = path.join(appConfig.dataDir, PROCESSING_DIR_NAME, ref.fileId);
    const renditionPath = new UserFileSystem(ref.userId).getRenditionPath(
        ref.collectionId,
        ref.fileId
    );
    let storedRendition = false;
    try {
        await rm(workDir, { recursive: true, force: true });
        await mkdir(workDir, { recursive: true });
        const originalPath = path.join(workDir, "original");
        await pipeline(
            dependencies.openDecryptedFile(ref),
            createWriteStream(originalPath)
        );
        const codecs = await VideoHelper.probeCodecs(originalPath);
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
            // Encrypted before it leaves the processing directory, so no plaintext lands next to the original
            await Cryptography.encryptFile(outputPath);
            await mkdir(path.dirname(renditionPath), { recursive: true });
            await rename(outputPath, renditionPath);
            storedRendition = true;
        } else {
            // A Rendition left from an earlier run would no longer match
            await rm(renditionPath, { force: true });
        }
        const recorded = await recordResult(ref.fileId, {
            processingStatus: "done",
            processingError: null,
            hasRendition: storedRendition
        });
        if (!recorded && storedRendition) {
            // Deleted while it was being processed
            await rm(renditionPath, { force: true });
        }
        logger.info(
            `Processed video '${ref.fileId}' (${plan ? `${plan}d to a Rendition` : "web-safe"})`
        );
    } catch (error) {
        logger.error(`Could not process video '${ref.fileId}'`, error);
        if (storedRendition) {
            await rm(renditionPath, { force: true }).catch(() => {});
        }
        await recordResult(ref.fileId, {
            processingStatus: "failed",
            processingError: getErrorMessage(error),
            hasRendition: false
        }).catch((updateError) =>
            logger.error(`Could not mark video '${ref.fileId}' failed`, updateError)
        );
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch((error) =>
            logger.error(`Could not delete '${workDir}'`, error)
        );
    }
}

/** Records a processed video's result; false if it no longer exists or is no longer being processed */
async function recordResult(
    fileId: string,
    fields: Pick<CollectionFile, "processingStatus" | "processingError" | "hasRendition">
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

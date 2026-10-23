import Database from "@/db/Database";
import { createWriteStream } from "fs";
import { mkdir, rename, rm, rmdir } from "fs/promises";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import appConfig from "../common/app-config";
import Cryptography from "../common/cryptography";
import { ImageHelper } from "../common/image-helper";
import Log, { LogColor } from "../common/log";
import { UserFileSystem } from "../common/user-file-system";
import { EMPTY_UUIDV4, getErrorMessage } from "../common/utilities";
import { VideoHelper } from "../common/video-helper";

/** How many of one user's thumbnails are waiting for the worker, and how many could not be made */
export interface ThumbnailStatus {
    pending: number;
    failed: number;
}

/** A file whose thumbnail could not be made; it shows its blur placeholder instead */
export interface FailedThumbnail {
    id: string;
    collectionId: string;
    name: string;
    error: string | null;
}

/** A file whose thumbnail is to be made */
export interface PendingFile {
    id: string;
    collectionId: string;
    userId: string;
    mimeType: string;
}

/** The outcome of making one thumbnail, as recorded on its file */
export type ThumbnailResult =
    | {
          thumbnailStatus: "ready";
          thumbnailError: null;
          thumbnailWidth: number;
          thumbnailHeight: number;
      }
    | { thumbnailStatus: "failed"; thumbnailError: string };

/** A file handed over before its row exists, waiting for a free lane */
interface HandedOverFile {
    file: PendingFile;
    signal: AbortSignal;
    resolve: (result: ThumbnailResult | null) => void;
}

/** Where the worker stages each file's plaintext while making its thumbnail; only ever holds files in progress */
const THUMBNAILS_DIR_NAME = "thumbnails";

/** One thumbnail at a time per spare core, leaving a core for serving requests */
const CONCURRENCY = Math.max(1, os.availableParallelism() - 1);

const logger = new Log("THUMBNAIL", LogColor.CYAN);

/**
 * Thumbnails made in the background for one user's files whose thumbnail is
 * pending, such as restored files. Uploads make theirs during the upload, so
 * their files are ready from the start.
 */
export class ThumbnailService {
    constructor(private readonly userId: string) {}

    async getStatus(): Promise<ThumbnailStatus> {
        const db = await Database.getInstance();
        const counts = (await db.select(
            `SELECT f."thumbnailStatus" AS status, COUNT(*)::int AS count
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE c."UserId" = :userId AND f."thumbnailStatus" <> 'ready'
                GROUP BY f."thumbnailStatus"`,
            { userId: this.userId }
        )) as { status: string; count: number }[];
        const countOf = (status: string) =>
            counts.find((row) => row.status === status)?.count ?? 0;
        return { pending: countOf("pending"), failed: countOf("failed") };
    }

    /** The user's files whose thumbnail could not be made, oldest first, with the error each failed with */
    async getFailedThumbnails(): Promise<FailedThumbnail[]> {
        const db = await Database.getInstance();
        return (await db.select(
            `SELECT f.id, f."CollectionId" AS "collectionId", f.name,
                    f."thumbnailError" AS error
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE c."UserId" = :userId AND f."thumbnailStatus" = 'failed'
                ORDER BY f."createdAt", f.id`,
            { userId: this.userId }
        )) as FailedThumbnail[];
    }

    /** Starts the worker on files whose thumbnail is pending, such as files just restored */
    static kick() {
        getWorker().kick();
    }

    /**
     * Makes the thumbnail of a file that is in storage but whose row does not
     * exist yet, such as a file a Restore job has just written, ahead of
     * pending files. Resolves with the result, which is also recorded on the
     * file if its row exists by then, or with null if `signal` aborted before
     * it started.
     */
    static makeEarly(
        file: PendingFile,
        signal: AbortSignal
    ): Promise<ThumbnailResult | null> {
        return getWorker().makeEarly(file, signal);
    }

    /**
     * Run once on server start: empties the directory where a previous process
     * staged plaintext and resumes the pending thumbnails. Resolves once
     * recovery is done.
     */
    static recover(): Promise<void> {
        return getWorker().recover();
    }
}

/** Makes pending thumbnails across the whole instance, oldest first, several at a time */
class ThumbnailWorker {
    private draining = false;
    private queueChanged = false;
    /** Each file being worked on, by id, until its thumbnail is recorded */
    private readonly inProgress = new Map<string, Promise<void>>();
    /** Files handed over before their row exists, oldest first */
    private readonly handedOver: HandedOverFile[] = [];
    /** Lets a file handed over take a free lane without waiting for one in progress to finish */
    private wakeUp = () => {};
    private recoveryRequests: {
        resolve: () => void;
        reject: (error: unknown) => void;
    }[] = [];

    recover() {
        const recovered = new Promise<void>((resolve, reject) =>
            this.recoveryRequests.push({ resolve, reject })
        );
        this.kick();
        return recovered;
    }

    makeEarly(file: PendingFile, signal: AbortSignal) {
        const result = new Promise<ThumbnailResult | null>((resolve) =>
            this.handedOver.push({ file, signal, resolve })
        );
        this.wakeUp();
        this.kick();
        return result;
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
            // A file marked pending while the last lookup was in flight must not be missed
            while (this.queueChanged) {
                this.queueChanged = false;
                // Before any file is started, so recovery never touches one in progress
                await this.runRequestedRecovery();
                await this.makePendingThumbnails();
            }
        } catch (error) {
            logger.error("Thumbnail worker stopped", error);
        } finally {
            // Synchronous with the last check above, so no kick is lost
            this.draining = false;
        }
    }

    /** Keeps every lane busy until no thumbnail is handed over, pending or in progress */
    private async makePendingThumbnails() {
        for (;;) {
            this.startHandedOver();
            const free = CONCURRENCY - this.inProgress.size;
            const next = free > 0 ? await this.findPending(free) : [];
            for (const file of next) {
                this.start(file.id, makePendingThumbnail(file));
            }
            if (this.inProgress.size === 0 && this.handedOver.length === 0) {
                return;
            }
            const woken = new Promise<void>((resolve) => (this.wakeUp = resolve));
            await Promise.race([...Array.from(this.inProgress.values()), woken]);
        }
    }

    private startHandedOver() {
        while (this.inProgress.size < CONCURRENCY && this.handedOver.length > 0) {
            const { file, signal, resolve } = this.handedOver.shift()!;
            if (signal.aborted || this.inProgress.has(file.id)) {
                resolve(null);
                continue;
            }
            this.start(file.id, makeEarlyThumbnail(file).then(resolve));
        }
    }

    private start(fileId: string, making: Promise<void>) {
        this.inProgress.set(
            fileId,
            making.finally(() => this.inProgress.delete(fileId))
        );
    }

    private async findPending(limit: number) {
        const db = await Database.getInstance();
        return (await db.select(
            `SELECT f.id, f."CollectionId" AS "collectionId",
                    c."UserId" AS "userId", f."mimeType"
                FROM "CollectionFiles" f
                JOIN "Collections" c ON c.id = f."CollectionId"
                WHERE f."thumbnailStatus" = 'pending' AND f.id NOT IN (:inProgress)
                ORDER BY f."createdAt", f.id
                LIMIT :limit`,
            {
                // Handed over files too, which wait for a free lane.
                // Never empty, which IN () would not accept
                inProgress: [
                    EMPTY_UUIDV4,
                    ...Array.from(this.inProgress.keys()),
                    ...this.handedOver.map(({ file }) => file.id)
                ],
                limit
            }
        )) as PendingFile[];
    }

    private async runRequestedRecovery() {
        const requests = this.recoveryRequests.splice(0);
        if (requests.length === 0) {
            return;
        }
        try {
            const thumbnailsDir = path.join(
                appConfig.dataDir,
                THUMBNAILS_DIR_NAME
            );
            await rm(thumbnailsDir, { recursive: true, force: true });
            logger.info("Recovered thumbnails: staging directory emptied");
            requests.forEach((request) => request.resolve());
        } catch (error) {
            logger.error("Could not recover thumbnails", error);
            requests.forEach((request) => request.reject(error));
        }
    }
}

/** Makes a pending file's thumbnail and records it; a thumbnail made for a file deleted meanwhile is deleted */
async function makePendingThumbnail(file: PendingFile) {
    const result = await makeThumbnail(file);
    const recorded = await recordResult(file.id, result).catch((error) => {
        logger.error(`Could not record the thumbnail of '${file.id}'`, error);
        return true;
    });
    if (!recorded && result.thumbnailStatus === "ready") {
        await deleteThumbnail(
            new UserFileSystem(file.userId).getThumbnailPath(
                file.collectionId,
                file.id
            )
        );
    }
}

/**
 * Makes the thumbnail of a file whose row may not exist yet, and records it
 * if the row exists by now, inserted pending while the thumbnail was made.
 */
async function makeEarlyThumbnail(file: PendingFile) {
    const result = await makeThumbnail(file);
    await recordResult(file.id, result).catch((error) =>
        logger.error(`Could not record the thumbnail of '${file.id}'`, error)
    );
    return result;
}

/**
 * Decrypts the original to a temporary file in the data directory, makes its
 * thumbnail with the helper uploads use, encrypts it, moves it where uploads
 * store thumbnails and deletes the plaintext. Failures are returned, not thrown.
 */
async function makeThumbnail(file: PendingFile): Promise<ThumbnailResult> {
    const workDir = path.join(appConfig.dataDir, THUMBNAILS_DIR_NAME, file.id);
    const fileSystem = new UserFileSystem(file.userId);
    const storedPath = fileSystem.getThumbnailPath(file.collectionId, file.id);
    try {
        await rm(workDir, { recursive: true, force: true });
        await mkdir(workDir, { recursive: true });
        const originalPath = path.join(workDir, "original");
        const outputPath = path.join(workDir, "thumbnail");
        await pipeline(
            fileSystem.openDecryptedFile(file.collectionId, file.id),
            createWriteStream(originalPath)
        );
        const { thumbnailWidth, thumbnailHeight } = file.mimeType.startsWith(
            "video"
        )
            ? await VideoHelper.generateVideoThumbnail(originalPath, outputPath)
            : await ImageHelper.generateImageThumbnail(originalPath, outputPath);
        // Encrypted before it leaves the staging directory, so no plaintext lands next to the original
        await Cryptography.encryptFile(outputPath);
        await mkdir(path.dirname(storedPath), { recursive: true });
        await rename(outputPath, storedPath);
        return {
            thumbnailStatus: "ready",
            thumbnailError: null,
            thumbnailWidth,
            thumbnailHeight
        };
    } catch (error) {
        logger.error(`Could not make the thumbnail of '${file.id}'`, error);
        return {
            thumbnailStatus: "failed",
            thumbnailError: getErrorMessage(error)
        };
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch((error) =>
            logger.error(`Could not delete '${workDir}'`, error)
        );
    }
}

/**
 * Deletes a thumbnail stored for a file that no longer exists. Deleting the
 * file may have taken its collection's directory with it, which storing the
 * thumbnail made again: those directories go too once they are empty.
 */
async function deleteThumbnail(storedPath: string) {
    await rm(storedPath, { force: true });
    const thumbnailDir = path.dirname(storedPath);
    for (const dir of [thumbnailDir, path.dirname(thumbnailDir)]) {
        // Fails, and so keeps the directory, unless it is empty
        await rmdir(dir).catch(() => {});
    }
}

/** Records a thumbnail's result; false if its file does not exist or is no longer pending */
async function recordResult(fileId: string, fields: ThumbnailResult) {
    const db = await Database.getInstance();
    const [updated] = await db.models.CollectionFile.update(fields, {
        where: { id: fileId, thumbnailStatus: "pending" },
        // Not an edit of the file, so a restored file keeps its update time
        silent: true
    });
    return updated > 0;
}

declare global {
    // eslint-disable-next-line no-var
    var holviThumbnailWorker: ThumbnailWorker | undefined;
}

/**
 * The instance's one worker. Kept on globalThis because Next.js may load this
 * module more than once (per API route bundle, instrumentation, hot reload).
 */
function getWorker() {
    globalThis.holviThumbnailWorker ??= new ThumbnailWorker();
    return globalThis.holviThumbnailWorker;
}

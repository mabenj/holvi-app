import { readFile, rename } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    addThumbnail,
    createCollection,
    createUser,
    encryptedFilePath,
    listFiles,
    waitFor
} from "../../../test/fixtures";
import {
    createHoldingOpener,
    readZip,
    releaseHoldingOpeners
} from "../../../test/backup-fixtures";
import { resetDatabase } from "../../../test/database";
import {
    addVideo,
    generateVideo,
    hashVideoStream,
    probeVideo,
    topLevelBoxes
} from "../../../test/video-fixtures";
import appConfig from "../common/app-config";
import { isActiveBackupJobStatus } from "../types/backup-job-dto";
import { BackupService } from "./backup.service";
import { CollectionService } from "./collection.service";
import {
    VideoProcessingService,
    VideoProcessingStatus
} from "./video-processing.service";

function isIdle(status: VideoProcessingStatus) {
    return status.pending === 0 && status.processing === 0;
}

/** Queues the user's unprocessed videos and waits until the worker has handled them all */
async function processVideos(service: VideoProcessingService) {
    await service.processVideos();
    return waitFor(() => service.getStatus(), isIdle, 60_000);
}

async function playbackSrcOf(userId: string, collectionId: string, fileId: string) {
    const { files } = await new CollectionService(userId).browseFiles(
        collectionId
    );
    return files.find((file) => file.id === fileId)?.playbackSrc;
}

async function scrubPreviewOf(userId: string, collectionId: string, fileId: string) {
    const { files } = await new CollectionService(userId).browseFiles(
        collectionId
    );
    return files.find((file) => file.id === fileId)?.scrubPreview;
}

/** Fetches the image a Scrub preview source serves, as the player does, and reads its size and format */
async function readScrubPreview(userId: string, src: string) {
    const url = new URL(src, "http://holvi");
    expect(url.searchParams.get("variant")).toBe("scrubPreview");
    const { file, mimeType } = await new CollectionService(
        userId
    ).getScrubPreview(url.pathname.split("/")[3], url.searchParams.get("image")!);
    const { width, height, format } = await sharp(file).metadata();
    return { width, height, format, mimeType, content: file };
}

/** Reads the whole video a playback source streams, a chunk at a time, the way the player's range requests do */
async function readPlaybackSrc(userId: string, playbackSrc: string) {
    const url = new URL(playbackSrc, "http://holvi");
    const collectionId = url.pathname.split("/")[3];
    const service = new CollectionService(userId);
    const chunks: Buffer[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
        const { stream, chunkStartEnd, totalLengthBytes } =
            await service.getVideoStream(
                collectionId,
                url.searchParams.get("video")!,
                offset,
                { rendition: url.searchParams.get("variant") === "rendition" }
            );
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        total = totalLengthBytes;
        offset = chunkStartEnd[1] + 1;
    }
    return Buffer.concat(chunks);
}

/** Every MP4 and MOV starts with an ftyp box, so plaintext video holds these bytes near its start */
const FTYP = Buffer.from("ftyp", "latin1");

/** Every JPEG, such as a Scrub preview or one of its frames, starts with these bytes */
const JPEG_START = Buffer.from([0xff, 0xd8, 0xff]);

/** Whether a file's bytes hold a plaintext video or JPEG */
function isPlaintext(content: Buffer) {
    return (
        content.subarray(0, 64).includes(FTYP) ||
        content.subarray(0, 3).equals(JPEG_START)
    );
}

/** Files under the data directory whose bytes hold a plaintext video or JPEG */
async function findPlaintextFiles() {
    const found: string[] = [];
    for (const file of await listFiles(appConfig.dataDir)) {
        const content = await readFile(path.join(appConfig.dataDir, file));
        if (isPlaintext(content)) {
            found.push(file);
        }
    }
    return found;
}

function originalSrc(collectionId: string, fileId: string) {
    return `/api/collections/${collectionId}/files?video=${fileId}`;
}

describe("VideoProcessingService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        releaseHoldingOpeners();
    });

    it("gives a web-safe MP4 a Scrub preview but no Rendition, so it plays from its original", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const video = await addVideo(user.id, trip.id, "clip", {
            videoCodec: "h264",
            audio: "aac",
            container: "mp4"
        });
        const service = new VideoProcessingService(user.id);

        const status = await processVideos(service);

        expect(status).toMatchObject({ done: 1, failed: 0 });
        expect(await playbackSrcOf(user.id, trip.id, video.id)).toBe(
            originalSrc(trip.id, video.id)
        );
        const scrubPreview = await scrubPreviewOf(user.id, trip.id, video.id);
        expect(scrubPreview).toBeDefined();
        expect(await readScrubPreview(user.id, scrubPreview!.src)).toMatchObject({
            format: "jpeg",
            mimeType: "image/jpeg"
        });
        // The original and its Scrub preview, and no Rendition
        expect(await listFiles(path.join(appConfig.dataDir, user.id))).toHaveLength(2);
    });

    it("samples a Scrub preview's frames a second apart, at most 100 of them, tiled as its layout says", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const webSafe = { videoCodec: "h264", audio: "none", container: "mp4" } as const;
        const short = await addVideo(user.id, trip.id, "short", {
            ...webSafe,
            durationSeconds: 3
        });
        const long = await addVideo(user.id, trip.id, "long", {
            ...webSafe,
            durationSeconds: 150
        });

        await processVideos(new VideoProcessingService(user.id));

        const shortPreview = (await scrubPreviewOf(user.id, trip.id, short.id))!;
        expect(shortPreview.layout).toEqual({
            intervalSeconds: 1,
            frames: 3,
            columns: 3,
            rows: 1,
            // About 160 px wide, keeping the 96x64 video's proportions at even sizes
            tileWidth: 160,
            tileHeight: 106
        });
        const longPreview = (await scrubPreviewOf(user.id, trip.id, long.id))!;
        expect(longPreview.layout).toEqual({
            intervalSeconds: 1.5,
            frames: 100,
            columns: 10,
            rows: 10,
            tileWidth: 160,
            tileHeight: 106
        });
        for (const { src, layout } of [shortPreview, longPreview]) {
            expect(await readScrubPreview(user.id, src)).toMatchObject({
                width: layout.columns * layout.tileWidth,
                height: layout.rows * layout.tileHeight
            });
        }
    });

    it("gives a video that is not web-safe a Scrub preview and a playable H.264/AAC MP4 Rendition at the original resolution", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const video = await addVideo(user.id, trip.id, "iphone", {
            videoCodec: "hevc",
            audio: "aac",
            container: "mov"
        });

        const status = await processVideos(new VideoProcessingService(user.id));

        expect(status).toMatchObject({ done: 1, failed: 0 });
        const scrubPreview = await scrubPreviewOf(user.id, trip.id, video.id);
        expect(await readScrubPreview(user.id, scrubPreview!.src)).toMatchObject({
            format: "jpeg"
        });
        const playbackSrc = await playbackSrcOf(user.id, trip.id, video.id);
        expect(playbackSrc).not.toBe(originalSrc(trip.id, video.id));
        const rendition = await readPlaybackSrc(user.id, playbackSrc!);
        expect(await probeVideo(rendition)).toMatchObject({
            videoCodec: "h264",
            pixelFormat: "yuv420p",
            audioCodec: "aac",
            container: "mp4",
            width: 96,
            height: 64
        });
        // The moov atom at the front lets playback start before the whole file has loaded
        const boxes = topLevelBoxes(rendition);
        expect(boxes.indexOf("moov")).toBeLessThan(boxes.indexOf("mdat"));
    });

    it("gives an H.264/AAC MOV a Rendition that remuxes it into an MP4 without re-encoding", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const original = await generateVideo({
            videoCodec: "h264",
            audio: "aac",
            container: "mov"
        });
        const video = await addFile(user.id, trip.id, "camera.mov", original, {
            mimeType: "video/quicktime"
        });

        await processVideos(new VideoProcessingService(user.id));

        const playbackSrc = await playbackSrcOf(user.id, trip.id, video.id);
        expect(playbackSrc).not.toBe(originalSrc(trip.id, video.id));
        const rendition = await readPlaybackSrc(user.id, playbackSrc!);
        expect(await probeVideo(rendition)).toMatchObject({
            videoCodec: "h264",
            audioCodec: "aac",
            container: "mp4"
        });
        expect(await hashVideoStream(rendition)).toBe(
            await hashVideoStream(original)
        );
        const boxes = topLevelBoxes(rendition);
        expect(boxes.indexOf("moov")).toBeLessThan(boxes.indexOf("mdat"));
    });

    it("stores the Rendition and the Scrub preview encrypted, next to an original that stays byte-identical", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const video = await addVideo(user.id, trip.id, "iphone", {
            videoCodec: "hevc",
            audio: "none",
            container: "mp4"
        });
        const originalPath = encryptedFilePath(user.id, trip.id, video.id);
        const originalBefore = await readFile(originalPath);

        await processVideos(new VideoProcessingService(user.id));

        expect((await readFile(originalPath)).equals(originalBefore)).toBe(true);
        const stored = await listFiles(path.join(appConfig.dataDir, user.id));
        const outputFiles = stored.filter(
            (file) => file !== path.join(trip.id, video.id)
        );
        expect(outputFiles).toHaveLength(2);
        const rendition = await readPlaybackSrc(
            user.id,
            (await playbackSrcOf(user.id, trip.id, video.id))!
        );
        const scrubPreview = (
            await readScrubPreview(
                user.id,
                (await scrubPreviewOf(user.id, trip.id, video.id))!.src
            )
        ).content;
        expect(rendition.subarray(0, 64).includes(FTYP)).toBe(true);
        expect(scrubPreview.subarray(0, 3).equals(JPEG_START)).toBe(true);
        for (const file of outputFiles) {
            // Next to the original, in the collection's directory
            expect(path.dirname(path.dirname(file))).toBe(trip.id);
            const content = await readFile(path.join(appConfig.dataDir, user.id, file));
            expect(isPlaintext(content)).toBe(false);
            expect(content.includes(rendition.subarray(0, 256))).toBe(false);
            expect(content.includes(scrubPreview.subarray(0, 256))).toBe(false);
        }
    });

    it("leaves no plaintext behind, whether a video gets a Rendition and a Scrub preview, only a Scrub preview, or fails", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        await addVideo(user.id, trip.id, "iphone", {
            videoCodec: "hevc",
            audio: "aac",
            container: "mov"
        });
        await addVideo(user.id, trip.id, "web", {
            videoCodec: "h264",
            audio: "aac",
            container: "mp4"
        });
        // Cut off before its moov atom, so it cannot be probed
        const whole = await generateVideo({
            videoCodec: "hevc",
            audio: "aac",
            container: "mov",
            durationSeconds: 2
        });
        await addFile(user.id, trip.id, "cut.mov", whole.subarray(0, 2_000), {
            mimeType: "video/quicktime"
        });

        const status = await processVideos(new VideoProcessingService(user.id));

        expect(status).toMatchObject({ done: 2, failed: 1 });
        expect(await findPlaintextFiles()).toEqual([]);
        // Three originals, one Rendition and two Scrub previews, and nothing
        // outside the users' directories
        expect(await listFiles(path.join(appConfig.dataDir, user.id))).toHaveLength(6);
        expect(
            (await listFiles(appConfig.dataDir)).filter(
                (file) => !/^[0-9a-f-]{36}[\\/]/.test(file)
            )
        ).toEqual([]);
    });

    it("deletes a video's Rendition and Scrub preview with the video, whether deleted alone or among others", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const hevc = { videoCodec: "hevc", audio: "aac", container: "mov" } as const;
        const alone = await addVideo(user.id, trip.id, "alone", hevc);
        const among = await addVideo(user.id, trip.id, "among", hevc);
        for (const video of [alone, among]) {
            await addThumbnail(user.id, trip.id, video.id, Buffer.from("png"));
        }
        await processVideos(new VideoProcessingService(user.id));
        const userDir = path.join(appConfig.dataDir, user.id);
        // Each video's original, thumbnail, Rendition and Scrub preview
        expect(await listFiles(userDir)).toHaveLength(8);

        const collections = new CollectionService(user.id);
        await collections.deleteFile(trip.id, alone.id);
        await collections.multiDelete([among.id]);

        expect(await listFiles(userDir)).toEqual([]);
    });

    it("leaves Renditions and Scrub previews out of a Backup, which holds the original only", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const original = await generateVideo({
            videoCodec: "hevc",
            audio: "aac",
            container: "mov"
        });
        const video = await addFile(user.id, trip.id, "iphone.mov", original, {
            mimeType: "video/quicktime"
        });
        await processVideos(new VideoProcessingService(user.id));
        const rendition = await readPlaybackSrc(
            user.id,
            (await playbackSrcOf(user.id, trip.id, video.id))!
        );
        const { content: scrubPreview } = await readScrubPreview(
            user.id,
            (await scrubPreviewOf(user.id, trip.id, video.id))!.src
        );
        const backups = new BackupService(user.id);

        const started = await backups.start();
        const job = await waitFor(
            () => backups.getJob(started.id),
            (job) => !isActiveBackupJobStatus(job.status)
        );

        expect(job.status).toBe("completed");
        const entries = await readZip((await backups.openDownload(job.id)).filePath);
        const files = entries.filter((entry) => entry.name.startsWith("files/"));
        expect(files.map((entry) => entry.name)).toEqual(["files/Trip/iphone.mov"]);
        expect(files[0].data.equals(original)).toBe(true);
        for (const entry of entries) {
            expect(entry.data.includes(rendition.subarray(0, 256))).toBe(false);
            expect(entry.data.includes(scrubPreview.subarray(0, 256))).toBe(false);
        }
    });

    it("queues only the user's videos that were never processed or failed, and counts them through processing", async () => {
        const hevc = { videoCodec: "hevc", audio: "aac", container: "mov" } as const;
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const trip = await createCollection(alice.id, "Trip");
        const bobsTrip = await createCollection(bob.id, "Bob's trip");
        const bobsVideo = await addVideo(bob.id, bobsTrip.id, "bobs", hevc);
        // Fails while its original is missing
        const retried = await addVideo(alice.id, trip.id, "retried", hevc);
        const retriedPath = encryptedFilePath(alice.id, trip.id, retried.id);
        await rename(retriedPath, `${retriedPath}.away`);
        expect(await processVideos(new VideoProcessingService(alice.id))).toEqual({
            pending: 0,
            processing: 0,
            done: 0,
            failed: 1,
            currentFile: null
        });
        await rename(`${retriedPath}.away`, retriedPath);
        await addVideo(alice.id, trip.id, "iphone", hevc);
        await addVideo(alice.id, trip.id, "web", {
            videoCodec: "h264",
            audio: "aac",
            container: "mp4"
        });
        await addFile(alice.id, trip.id, "photo.jpg", Buffer.from("not a video"));
        const holding = createHoldingOpener();
        const service = new VideoProcessingService(alice.id, {
            openDecryptedFile: holding.openDecryptedFile
        });

        const queued = await service.processVideos();
        const midway = await waitFor(
            () => service.getStatus(),
            (status) => status.processing === 1
        );
        holding.release();
        const finished = await waitFor(() => service.getStatus(), isIdle, 60_000);

        expect(queued).toEqual({
            pending: 3,
            processing: 0,
            done: 0,
            failed: 0,
            currentFile: null
        });
        // Oldest first
        expect(midway).toEqual({
            pending: 2,
            processing: 1,
            done: 0,
            failed: 0,
            currentFile: { id: retried.id, collectionId: trip.id, name: "retried.mov" }
        });
        expect(finished).toEqual({
            pending: 0,
            processing: 0,
            done: 3,
            failed: 0,
            currentFile: null
        });
        expect(await new VideoProcessingService(bob.id).getStatus()).toEqual({
            pending: 0,
            processing: 0,
            done: 0,
            failed: 0,
            currentFile: null
        });
        expect(await playbackSrcOf(bob.id, bobsTrip.id, bobsVideo.id)).toBe(
            originalSrc(bobsTrip.id, bobsVideo.id)
        );
    });
});

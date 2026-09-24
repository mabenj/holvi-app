import type Ffmpeg from "fluent-ffmpeg";
import { mkdir, readdir, rename, unlink } from "fs/promises";
import path from "path";
import type { ScrubPreviewLayout } from "../types/scrub-preview";
import appConfig from "./app-config";
import { HolviError } from "./errors";
import { createDirIfNotExists } from "./file-system-helpers";
import Log, { LogColor } from "./log";
import { getErrorMessage } from "./utilities";

/** How video processing makes a video's Rendition, or null if its original is web-safe */
export type RenditionPlan = null | "remux" | "transcode";

/** A video's codecs and container, as video processing needs them */
export interface VideoCodecs {
    videoCodec: string;
    pixelFormat: string | null;
    /** One per audio stream */
    audioCodecs: string[];
    /** True for MP4, false for QuickTime MOV and every other container */
    isMp4: boolean;
}

/** What video processing reads from a video before processing it */
export interface VideoProbe {
    codecs: VideoCodecs;
    /** When the video was shot, as its file records it; null if it records none */
    captureDate: Date | null;
}

/**
 * When a video was shot: the container's creation_time tag, or else the video
 * stream's. Null when neither holds a usable date.
 */
function readCaptureDate(metadata: Ffmpeg.FfprobeData): Date | null {
    const videoStream = metadata.streams.find(
        (stream) =>
            stream.codec_type === "video" && !stream.disposition?.attached_pic
    );
    return (
        parseCaptureDate(metadata.format.tags?.creation_time) ??
        parseCaptureDate(videoStream?.tags?.creation_time)
    );
}

/** A tag's date, unless it is missing, unparseable or a placeholder */
function parseCaptureDate(tag: unknown): Date | null {
    if (typeof tag !== "string" || !ISO_DATE_TIME.test(tag.trim())) {
        return null;
    }
    const date = new Date(tag.trim());
    if (isNaN(date.getTime()) || isPlaceholderDate(date)) {
        return null;
    }
    return date;
}

/** ffprobe reports creation_time as ISO 8601, such as 2019-07-14T08:30:15.000000Z */
const ISO_DATE_TIME =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Fourteen hours either side of an epoch's midnight in UTC covers its local midnight in every time zone */
const PLACEHOLDER_MARGIN_MS = 14 * 60 * 60 * 1000;

/**
 * Whether a capture date is a device's placeholder rather than when the video
 * was shot: anything up to the Unix epoch (which also covers the QuickTime
 * epoch of 1904), or the DOS epoch of 1980, which devices with a reset clock
 * record. Each epoch counts at local midnight in any time zone.
 */
function isPlaceholderDate(date: Date) {
    const time = date.getTime();
    const dosEpoch = Date.UTC(1980, 0, 1);
    return (
        time <= Date.UTC(1970, 0, 1) + PLACEHOLDER_MARGIN_MS ||
        Math.abs(time - dosEpoch) <= PLACEHOLDER_MARGIN_MS
    );
}

/** H.264 in 8-bit 4:2:0; yuvj420p is the full-range variant some cameras record */
const WEB_SAFE_PIXEL_FORMATS = ["yuv420p", "yuvj420p"];

/**
 * A video is web-safe if its original is H.264 (8-bit 4:2:0) with AAC audio or
 * no audio, in an MP4 container. Anything else gets a Rendition: a remux when
 * only the container is wrong, and otherwise a re-encode.
 */
export function planRendition(codecs: VideoCodecs): RenditionPlan {
    const codecsWebSafe =
        codecs.videoCodec === "h264" &&
        WEB_SAFE_PIXEL_FORMATS.includes(codecs.pixelFormat ?? "") &&
        codecs.audioCodecs.every((codec) => codec === "aac");
    if (!codecsWebSafe) {
        return "transcode";
    }
    return codecs.isMp4 ? null : "remux";
}

/** A Scrub preview holds at most this many frames */
export const SCRUB_PREVIEW_MAX_FRAMES = 100;
/** Frames of a short video are this far apart, in seconds */
const SCRUB_PREVIEW_MIN_INTERVAL_SECONDS = 1;
/** How wide each frame is, in pixels; its height keeps the video's proportions */
const SCRUB_PREVIEW_TILE_WIDTH = 160;
/** A full Scrub preview is a square of frames */
const SCRUB_PREVIEW_MAX_COLUMNS = 10;

/**
 * Seconds between a Scrub preview's frames: a second, or more for a video
 * too long to preview every second in its frames, rounded up to the
 * millisecond so the frames never outnumber the maximum.
 */
export function scrubPreviewInterval(durationSeconds: number) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return SCRUB_PREVIEW_MIN_INTERVAL_SECONDS;
    }
    const interval =
        Math.ceil((durationSeconds / SCRUB_PREVIEW_MAX_FRAMES) * 1000) / 1000;
    return Math.max(SCRUB_PREVIEW_MIN_INTERVAL_SECONDS, interval);
}

/** How a Scrub preview tiles its frames: rows of up to ten, as square as they fit */
export function scrubPreviewGrid(frames: number) {
    const columns = Math.min(SCRUB_PREVIEW_MAX_COLUMNS, frames);
    return { columns, rows: Math.ceil(frames / columns) };
}

export class VideoHelper {
    private static readonly logger = new Log("VID", LogColor.YELLOW);

    /**
     * Writes a video's Scrub preview as one JPEG: a frame every interval from
     * the start, each scaled to about 160 px wide, tiled left to right and top
     * to bottom. The frames are staged in `workDir`, which the caller deletes.
     */
    static async produceScrubPreview(
        sourcePath: string,
        workDir: string,
        targetPath: string
    ): Promise<ScrubPreviewLayout> {
        const { durationInSeconds } = await this.getVideoMetadata(sourcePath);
        const intervalSeconds = scrubPreviewInterval(durationInSeconds ?? NaN);
        const framesDir = path.join(workDir, "scrub-frames");
        await mkdir(framesDir, { recursive: true });
        const ffmpeg = await this.importFfmpeg();
        await new Promise<void>((resolve, reject) =>
            ffmpeg(sourcePath)
                .outputOptions([
                    "-an",
                    // The first frame at or after each multiple of the interval
                    "-vf",
                    `select=gte(t\\,selected_n*${intervalSeconds}),scale=${SCRUB_PREVIEW_TILE_WIDTH}:-2`,
                    // One output frame per selected frame, not a constant rate
                    ...["-vsync", "vfr"],
                    ...["-frames:v", String(SCRUB_PREVIEW_MAX_FRAMES)],
                    ...["-q:v", "4"]
                ])
                .on("end", () => resolve())
                .on("error", (error) => reject(error))
                .save(path.join(framesDir, "%03d.jpg"))
        );
        const frameFiles = (await readdir(framesDir))
            .filter((name) => name.endsWith(".jpg"))
            .sort();
        if (frameFiles.length === 0) {
            throw new HolviError("No frames for the Scrub preview");
        }
        const { default: sharp } = await import("sharp");
        const framePaths = frameFiles.map((name) => path.join(framesDir, name));
        const { width: tileWidth, height: tileHeight } = await sharp(
            framePaths[0]
        ).metadata();
        if (!tileWidth || !tileHeight) {
            throw new HolviError("Could not read a Scrub preview frame");
        }
        const { columns, rows } = scrubPreviewGrid(framePaths.length);
        await sharp({
            create: {
                width: columns * tileWidth,
                height: rows * tileHeight,
                channels: 3,
                background: { r: 0, g: 0, b: 0 }
            }
        })
            .composite(
                framePaths.map((input, index) => ({
                    input,
                    left: (index % columns) * tileWidth,
                    top: Math.floor(index / columns) * tileHeight
                }))
            )
            .jpeg({ quality: 70 })
            .toFile(targetPath);
        return {
            intervalSeconds,
            frames: framePaths.length,
            columns,
            rows,
            tileWidth,
            tileHeight
        };
    }

    static async convertToMov(sourcePath: string) {
        const ffmpeg = await this.importFfmpeg();
        const targetPath = sourcePath + "_temp";
        try {
            this.logger.info("Converting file to mov");
            await new Promise((resolve, reject) =>
                ffmpeg(sourcePath)
                    .format("mov")
                    .on("end", async (result) => resolve(result))
                    .on("error", (error) => reject(error))
                    .save(targetPath)
            );
            await unlink(sourcePath);
            await rename(targetPath, sourcePath);
        } catch (error) {
            this.logger.warn(
                `Could not convert file to mov (${getErrorMessage(error)})`
            );
        }
    }

    static async getVideoMetadata(sourcePath: string) {
        const ffmpeg = await this.importFfmpeg();

        const metadata = await new Promise<Ffmpeg.FfprobeData>(
            (resolve, reject) => {
                ffmpeg.ffprobe(sourcePath, (error, metadata) => {
                    if (error) {
                        reject(error);
                    }

                    resolve(metadata);
                });
            }
        );

        return {
            durationInSeconds: metadata.format.duration,
            format: metadata.format.format_name,
            captureDate: readCaptureDate(metadata)
        };
    }

    /** Reads the codecs and container video processing decides a Rendition by, and the capture date */
    static async probe(sourcePath: string): Promise<VideoProbe> {
        const ffmpeg = await this.importFfmpeg();
        const metadata = await new Promise<Ffmpeg.FfprobeData>(
            (resolve, reject) =>
                ffmpeg.ffprobe(sourcePath, (error, metadata) =>
                    error ? reject(error) : resolve(metadata)
                )
        );
        // Cover art is stored as a video stream too
        const videoStream = metadata.streams.find(
            (stream) =>
                stream.codec_type === "video" &&
                !stream.disposition?.attached_pic
        );
        if (!videoStream?.codec_name) {
            throw new HolviError("The file has no video stream");
        }
        const majorBrand = String(metadata.format.tags?.major_brand ?? "")
            .trim()
            .toLowerCase();
        return {
            codecs: {
                videoCodec: videoStream.codec_name,
                pixelFormat: videoStream.pix_fmt ?? null,
                audioCodecs: metadata.streams
                    .filter((stream) => stream.codec_type === "audio")
                    .map((stream) => stream.codec_name ?? "unknown"),
                // MP4 and MOV share one demuxer; QuickTime files carry the qt brand
                isMp4:
                    !!metadata.format.format_name?.includes("mp4") &&
                    majorBrand !== "qt" &&
                    !majorBrand.startsWith("3g")
            },
            captureDate: readCaptureDate(metadata)
        };
    }

    /**
     * Writes a Rendition as an H.264/AAC MP4 with the moov atom at the front, so
     * playback can start before it is fully loaded. A remux copies the streams;
     * a transcode re-encodes the video at the original resolution with its
     * bitrate capped, and copies the audio if it is already AAC.
     */
    static async produceRendition(
        sourcePath: string,
        targetPath: string,
        plan: "remux" | "transcode",
        codecs: VideoCodecs,
        maxBitrateKbps: number
    ) {
        const ffmpeg = await this.importFfmpeg();
        const copyAudio = codecs.audioCodecs[0] === "aac";
        const streamOptions =
            plan === "remux"
                ? ["-c", "copy"]
                : [
                      "-c:v",
                      "libx264",
                      "-preset",
                      "veryfast",
                      "-crf",
                      "21",
                      "-maxrate",
                      `${maxBitrateKbps}k`,
                      "-bufsize",
                      `${2 * maxBitrateKbps}k`,
                      "-pix_fmt",
                      "yuv420p",
                      // 4:2:0 needs even dimensions; others lose at most one pixel
                      "-vf",
                      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                      ...(copyAudio
                          ? ["-c:a", "copy"]
                          : ["-c:a", "aac", "-b:a", "192k"])
                  ];
        await new Promise<void>((resolve, reject) =>
            ffmpeg(sourcePath)
                .outputOptions([
                    // The first video and audio streams; data tracks are left out
                    ...["-map", "0:v:0", "-map", "0:a:0?"],
                    ...streamOptions,
                    ...["-movflags", "+faststart"]
                ])
                .format("mp4")
                .on("end", () => resolve())
                .on("error", (error) => reject(error))
                .save(targetPath)
        );
    }

    static async generateVideoThumbnail(
        sourcePath: string,
        targetPath: string
    ) {
        const dirname = path.dirname(targetPath);
        await createDirIfNotExists(dirname);

        const thumbnailTimePercentage = 50;
        const ffmpeg = await this.importFfmpeg();

        return new Promise<{
            width: number;
            height: number;
            thumbnailWidth: number;
            thumbnailHeight: number;
        }>((resolve, reject) =>
            ffmpeg.ffprobe(sourcePath, (error, metadata) => {
                try {
                    if (error) {
                        throw error;
                    }

                    const videoStream = metadata.streams.find(
                        (stream) => stream.codec_type === "video"
                    );
                    if (!videoStream) {
                        throw new Error("Could not find video stream");
                    }
                    let rotation = 0;
                    if (videoStream.rotation) {
                        if (typeof videoStream.rotation === "number") {
                            rotation = Math.abs(videoStream.rotation);
                        } else {
                            rotation = Math.abs(
                                Number(videoStream.rotation.replace(/\D/g, ""))
                            );
                        }
                    }
                    const videoWidth = videoStream.width || 0;
                    const videoHeight = videoStream.height || 0;
                    const { width: thumbnailWidth, height: thumbnailHeight } =
                        calculateResolution({
                            originalWidth:
                                rotation === 90 ? videoHeight : videoWidth,
                            originalHeight:
                                rotation === 90 ? videoWidth : videoHeight,
                            maxWidth: appConfig.thumbnailMaxWidth,
                            maxHeight: appConfig.thumbnailMaxHeight
                        });

                    const thumbnailTime =
                        (metadata.format.duration || 1) *
                        (thumbnailTimePercentage / 100);
                    ffmpeg(sourcePath)
                        .on("end", async () => {
                            // takeScreenshots() will add an unwanted .png extension
                            await rename(targetPath + ".png", targetPath);
                            resolve({
                                width: videoWidth,
                                height: videoHeight,
                                thumbnailWidth,
                                thumbnailHeight
                                // durationInSeconds: metadata.format.duration
                            });
                        })
                        .on("error", (error) => {
                            throw error;
                        })
                        .takeScreenshots(
                            {
                                count: 1,
                                fastSeek: true,
                                timestamps: [thumbnailTime],
                                size: `${thumbnailWidth}x${thumbnailHeight}`,
                                filename: path.basename(targetPath)
                            },
                            dirname
                        );
                } catch (error) {
                    reject(
                        new HolviError(
                            "Error generating video thumbnail",
                            error
                        )
                    );
                }
            })
        );
    }

    private static async importFfmpeg() {
        const [
            { default: ffmpegStatic },
            { path: ffprobeStatic },
            { default: ffmpeg }
        ] = await Promise.all([
            import("ffmpeg-static"),
            import("ffprobe-static"),
            import("fluent-ffmpeg")
        ]);
        ffmpeg.setFfmpegPath(ffmpegStatic!);
        ffmpeg.setFfprobePath(ffprobeStatic!);
        return ffmpeg;
    }
}

function calculateResolution(options: {
    originalWidth: number;
    originalHeight: number;
    maxWidth: number;
    maxHeight: number;
}) {
    const { originalWidth, originalHeight, maxWidth, maxHeight } = options;
    const ratioW = originalWidth / maxWidth;
    const ratioH = originalHeight / maxHeight;
    const factor = ratioW > ratioH ? ratioW : ratioH;
    if (factor === 0) {
        return { width: originalWidth, height: originalHeight };
    }
    return {
        width: Math.floor(originalWidth / factor),
        height: Math.floor(originalHeight / factor)
    };
}

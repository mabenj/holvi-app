import type Ffmpeg from "fluent-ffmpeg";
import { rename, unlink } from "fs/promises";
import path from "path";
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

export class VideoHelper {
    private static readonly logger = new Log("VID", LogColor.YELLOW);

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
            format: metadata.format.format_name
        };
    }

    /** Reads the codecs and container video processing decides a Rendition by */
    static async probeCodecs(sourcePath: string): Promise<VideoCodecs> {
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

import type Ffmpeg from "fluent-ffmpeg";
import { rename, unlink } from "fs/promises";
import path from "path";
import appConfig from "./app-config";
import { HolviError } from "./errors";
import { createDirIfNotExists } from "./file-system-helpers";
import Log, { LogColor } from "./log";
import { getErrorMessage } from "./utilities";

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

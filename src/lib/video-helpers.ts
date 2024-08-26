import "server-only";

import Log, { LogColor } from "./log";
import type Ffmpeg from "fluent-ffmpeg";
import { rename, unlink } from "fs/promises";
import path from "path";
import { createDirIfNotExists } from "./file-system-helpers";
import { env } from "~/env";
import { getErrorMessage } from "./utils";

const LOGGER = new Log("VID", LogColor.YELLOW);

export async function convertToMov(sourcePath: string) {
  const ffmpeg = await importFfmpeg();
  const targetPath = sourcePath + "_temp";
  try {
    LOGGER.info("Converting file to mov");
    await new Promise((resolve, reject) =>
      ffmpeg(sourcePath)
        .format("mov")
        .on("end", (result) => resolve(result))
        .on("error", (error) => reject(error))
        .save(targetPath),
    );
    await unlink(sourcePath);
    await rename(targetPath, sourcePath);
  } catch (error) {
    LOGGER.warn(`Could not convert file to mov (${getErrorMessage(error)})`);
  }
}

export async function getVideoMetadata(sourcePath: string) {
  const ffmpeg = await importFfmpeg();

  const metadata = await new Promise<Ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(sourcePath, (error, metadata) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(error));
      }

      resolve(metadata);
    });
  });

  return {
    durationInSeconds: metadata.format.duration,
    format: metadata.format.format_name,
  };
}

export async function generateVideoThumbnail(
  sourcePath: string,
  targetPath: string,
) {
  const dirname = path.dirname(targetPath);
  await createDirIfNotExists(dirname);

  const thumbnailTimePercentage = 50;
  const ffmpeg = await importFfmpeg();

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
          (stream) => stream.codec_type === "video",
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
              Number(videoStream.rotation.replace(/\D/g, "")),
            );
          }
        }
        const videoWidth = videoStream.width ?? 0;
        const videoHeight = videoStream.height ?? 0;
        const { width: thumbnailWidth, height: thumbnailHeight } =
          calculateResolution({
            originalWidth: rotation === 90 ? videoHeight : videoWidth,
            originalHeight: rotation === 90 ? videoWidth : videoHeight,
            maxWidth: env.THUMBNAIL_MAX_WIDTH,
            maxHeight: env.THUMBNAIL_MAX_HEIGHT,
          });

        const thumbnailTime =
          (metadata.format.duration ?? 1) * (thumbnailTimePercentage / 100);
        ffmpeg(sourcePath)
          .on("end", () => {
            // takeScreenshots() will add an unwanted .png extension, so we rename it here
            void rename(targetPath + ".png", targetPath).then(() =>
              resolve({
                width: videoWidth,
                height: videoHeight,
                thumbnailWidth,
                thumbnailHeight,
                // durationInSeconds: metadata.format.duration
              }),
            );
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
              filename: path.basename(targetPath),
            },
            dirname,
          );
      } catch (error) {
        reject(
          new Error("Error generating video thumbnail", {
            cause: error,
          }),
        );
      }
    }),
  );
}

async function importFfmpeg() {
  const [
    { default: ffmpegStatic },
    { path: ffprobeStatic },
    { default: ffmpeg },
  ] = await Promise.all([
    import("ffmpeg-static"),
    import("ffprobe-static"),
    import("fluent-ffmpeg"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ffmpeg.setFfmpegPath(ffmpegStatic!);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ffmpeg.setFfprobePath(ffprobeStatic!);
  return ffmpeg;
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
    height: Math.floor(originalHeight / factor),
  };
}

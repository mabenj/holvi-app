import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { addFile, FileMetadata } from "./fixtures";

// Tiny videos are generated at test time with the bundled ffmpeg, so none are committed.

const run = promisify(execFile);

export interface GeneratedVideoOptions {
    /** hevc is not web-safe, in any container */
    videoCodec: "h264" | "hevc";
    audio: "aac" | "none";
    container: "mp4" | "mov";
    /**
     * The spec's capture date: written as the container's creation_time tag.
     * Video processing later copies it into the File's takenAt.
     */
    captureDate?: Date;
    durationSeconds?: number;
}

const ENCODERS = { h264: "libx264", hevc: "libx265" };
const DEFAULT_DURATION_SECONDS = 1;
const MIME_TYPES = { mp4: "video/mp4", mov: "video/quicktime" };

/** Encodes a tiny test-pattern video with a tone and returns its bytes */
export async function generateVideo({
    videoCodec,
    audio,
    container,
    captureDate,
    durationSeconds = DEFAULT_DURATION_SECONDS
}: GeneratedVideoOptions) {
    return withTempDir(async (dir) => {
        const output = path.join(dir, `video.${container}`);
        const args = [
            ...["-hide_banner", "-loglevel", "error"],
            ...["-f", "lavfi", "-i", `testsrc=size=96x64:rate=10:d=${durationSeconds}`],
            ...(audio === "aac"
                ? ["-f", "lavfi", "-i", `sine=frequency=440:d=${durationSeconds}`]
                : []),
            ...["-c:v", ENCODERS[videoCodec], "-pix_fmt", "yuv420p"],
            ...(audio === "aac" ? ["-c:a", "aac"] : ["-an"]),
            // Tags HEVC the way Apple devices do, so the fixture resembles an iPhone video
            ...(videoCodec === "hevc"
                ? ["-tag:v", "hvc1", "-x265-params", "log-level=error"]
                : []),
            ...(captureDate
                ? ["-metadata", `creation_time=${captureDate.toISOString()}`]
                : []),
            ...["-f", container, output]
        ];
        await run(ffmpegPath!, args);
        return readFile(output);
    });
}

/**
 * Generates a video and adds it to a collection as an encrypted video File.
 * The name gets the container's extension.
 */
export async function addVideo(
    userId: string,
    collectionId: string,
    name: string,
    options: GeneratedVideoOptions,
    metadata: Omit<FileMetadata, "mimeType"> = {}
) {
    return addFile(
        userId,
        collectionId,
        `${name}.${options.container}`,
        await generateVideo(options),
        {
            durationInSeconds: options.durationSeconds ?? DEFAULT_DURATION_SECONDS,
            ...metadata,
            mimeType: MIME_TYPES[options.container]
        }
    );
}

/** The types of an MP4 or MOV file's top-level boxes, in file order */
export function topLevelBoxes(content: Buffer) {
    const types: string[] = [];
    let offset = 0;
    while (offset + 8 <= content.length) {
        let size = content.readUInt32BE(offset);
        const type = content.toString("latin1", offset + 4, offset + 8);
        if (size === 1) {
            size = Number(content.readBigUInt64BE(offset + 8));
        } else if (size === 0) {
            size = content.length - offset;
        }
        if (size < 8) {
            break;
        }
        types.push(type);
        offset += size;
    }
    return types;
}

export interface ProbedVideo {
    videoCodec: string | null;
    /** The video stream's pixel format, such as yuv420p */
    pixelFormat: string | null;
    width: number | null;
    height: number | null;
    audioCodec: string | null;
    /** mov for QuickTime's major brand, mp4 for other ISO media brands, otherwise ffprobe's format name */
    container: string;
    captureDate: Date | null;
}

/** Reads a video's codecs, container and capture date with the bundled ffprobe */
export async function probeVideo(content: Buffer): Promise<ProbedVideo> {
    return withTempDir(async (dir) => {
        const input = path.join(dir, "video");
        await writeFile(input, content);
        const { stdout } = await run(ffprobePath, [
            ...["-v", "error", "-print_format", "json"],
            ...["-show_format", "-show_streams", input]
        ]);
        const probe = JSON.parse(stdout);
        const streamOf = (type: string) =>
            probe.streams.find((stream: any) => stream.codec_type === type);
        const codecOf = (type: string) => streamOf(type)?.codec_name ?? null;
        const majorBrand = probe.format.tags?.major_brand?.trim();
        const creationTime = probe.format.tags?.creation_time;
        return {
            videoCodec: codecOf("video"),
            pixelFormat: streamOf("video")?.pix_fmt ?? null,
            width: streamOf("video")?.width ?? null,
            height: streamOf("video")?.height ?? null,
            audioCodec: codecOf("audio"),
            container:
                majorBrand === "qt"
                    ? "mov"
                    : probe.format.format_name.includes("mp4")
                    ? "mp4"
                    : probe.format.format_name,
            captureDate: creationTime ? new Date(creationTime) : null
        };
    });
}

/**
 * A hash of a video's first video stream as stored, without decoding it: equal
 * for two files only if one holds the other's video unchanged, as a remux does.
 */
export async function hashVideoStream(content: Buffer) {
    return withTempDir(async (dir) => {
        const input = path.join(dir, "video");
        await writeFile(input, content);
        const { stdout } = await run(ffmpegPath!, [
            ...["-hide_banner", "-loglevel", "error", "-i", input],
            ...["-map", "0:v:0", "-c", "copy", "-f", "md5", "-"]
        ]);
        return stdout.trim();
    });
}

async function withTempDir<T>(work: (dir: string) => Promise<T>) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "holvi-video-"));
    try {
        return await work(dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

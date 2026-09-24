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
     * The spec's capture date, written the way ffmpeg and most cameras write
     * it: as the creation_time tag of the container and of every stream.
     * Video processing later copies it into the File's takenAt.
     */
    captureDate?: Date;
    /** For videos whose tags disagree or are malformed: each creation_time tag written separately. Wins over captureDate. */
    captureDateTags?: CaptureDateTags;
    durationSeconds?: number;
}

export interface CaptureDateTags {
    /** A Date is stored in the container's header (whole seconds); a string is written as a free-form metadata tag, however malformed */
    container?: Date | string;
    /** Stored in the video stream's header (whole seconds) */
    videoStream?: Date;
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
    captureDateTags,
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
            ...(captureDate && !captureDateTags
                ? ["-metadata", `creation_time=${captureDate.toISOString()}`]
                : []),
            // ffmpeg would parse a date string into the headers, so only a malformed one is written as text
            ...(typeof captureDateTags?.container === "string"
                ? [
                      ...["-movflags", "use_metadata_tags"],
                      ...["-metadata", `creation_time=${captureDateTags.container}`]
                  ]
                : []),
            ...["-f", container, output]
        ];
        await run(ffmpegPath!, args);
        const content = await readFile(output);
        if (captureDateTags?.container instanceof Date) {
            writeHeaderTime(content, findBox(content, ["moov", "mvhd"]), captureDateTags.container);
        }
        if (captureDateTags?.videoStream) {
            writeHeaderTime(content, findVideoMediaHeader(content), captureDateTags.videoStream);
        }
        return content;
    });
}

/** Seconds from the QuickTime epoch (1904) to the Unix epoch */
const QUICKTIME_EPOCH_OFFSET_SECONDS = 2_082_844_800;

interface Box {
    type: string;
    /** Where the box's content starts, after its header */
    start: number;
    end: number;
}

/** The child boxes of an MP4 or MOV box's content, or of the whole file */
function childBoxes(content: Buffer, start = 0, end = content.length) {
    const boxes: Box[] = [];
    let offset = start;
    while (offset + 8 <= end) {
        let size = content.readUInt32BE(offset);
        let headerSize = 8;
        if (size === 1) {
            size = Number(content.readBigUInt64BE(offset + 8));
            headerSize = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < headerSize) {
            break;
        }
        boxes.push({
            type: content.toString("latin1", offset + 4, offset + 8),
            start: offset + headerSize,
            end: offset + size
        });
        offset += size;
    }
    return boxes;
}

/** The box at a path of box types, such as moov/mvhd */
function findBox(content: Buffer, typePath: string[], within?: Box): Box {
    let box = within;
    for (const type of typePath) {
        const found = childBoxes(content, box?.start, box?.end).find(
            (child) => child.type === type
        );
        if (!found) {
            throw new Error(`No ${typePath.join("/")} box`);
        }
        box = found;
    }
    return box!;
}

/** The media header (mdhd) of the video track, whose creation time ffprobe reports as the video stream's creation_time */
function findVideoMediaHeader(content: Buffer) {
    const moov = findBox(content, ["moov"]);
    for (const trak of childBoxes(content, moov.start, moov.end)) {
        if (trak.type !== "trak") {
            continue;
        }
        const hdlr = findBox(content, ["mdia", "hdlr"], trak);
        // Version and flags, pre_defined, then the handler type
        if (content.toString("latin1", hdlr.start + 8, hdlr.start + 12) === "vide") {
            return findBox(content, ["mdia", "mdhd"], trak);
        }
    }
    throw new Error("No video track");
}

/** Overwrites the creation time of a movie (mvhd) or media (mdhd) header */
function writeHeaderTime(content: Buffer, header: Box, date: Date) {
    const seconds = Math.floor(date.getTime() / 1000) + QUICKTIME_EPOCH_OFFSET_SECONDS;
    // Version 1 headers hold 64-bit times, version 0 headers 32-bit ones, after the version and flags
    if (content.readUInt8(header.start) === 1) {
        content.writeBigUInt64BE(BigInt(seconds), header.start + 4);
    } else {
        content.writeUInt32BE(seconds, header.start + 4);
    }
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
    /** The creation_time tags as ffprobe reports them */
    captureDateTags: { container: string | null; videoStream: string | null };
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
            captureDate: creationTime ? new Date(creationTime) : null,
            captureDateTags: {
                container: creationTime ?? null,
                videoStream: streamOf("video")?.tags?.creation_time ?? null
            }
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

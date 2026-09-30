// The sample files the scenario plan puts into collections, by key: each
// committed file in demo/media (see its SOURCES.md), with its name and type
// and how to read its content when the seed uploads it

import { readdirSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MEDIA_DIR = fileURLToPath(new URL("../media", import.meta.url));

const MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime"
};

/**
 * Keyed by file name, e.g. "paella.jpg" or "loons.mov"
 *
 * @typedef {{ name: string, mimeType: string, content: () => Promise<Buffer> }} SampleFile
 * @type {Record<string, SampleFile>}
 */
export const SAMPLES = Object.fromEntries(
    readdirSync(MEDIA_DIR)
        .filter((name) => path.extname(name) in MIME_TYPES)
        .map((name) => [
            name,
            {
                name,
                mimeType: MIME_TYPES[path.extname(name)],
                content: () => readFile(path.join(MEDIA_DIR, name))
            }
        ])
);

/** The sample video that upload accepts and video processing fails on */
export const BROKEN_VIDEO = "broken-audio.mp4";

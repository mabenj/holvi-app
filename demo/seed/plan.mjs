// The scenario plan: what an empty demo is seeded with, as data. The seed
// signs up every User, then creates each collection for its owner and uploads
// its files. Every file names a sample file from media.mjs.

import { MEDIA } from "./media.mjs";

/** The demo's Users, by the name the plan and the checks call them */
export const USERS = {
    demo: { username: "demo", password: "demo1234" },
    other: { username: "other", password: "other1234" }
};

/**
 * @typedef {{
 *   media: string,
 *   name?: string,
 *   lastModified: string
 * }} PlannedFile a sample file, optionally renamed, with the last-modified
 *   time the client would send for it (which is also its taken time when it
 *   has no EXIF date)
 * @typedef {{
 *   owner: keyof typeof USERS,
 *   name: string,
 *   description?: string,
 *   tags?: string[],
 *   files: PlannedFile[]
 * }} PlannedCollection
 * @type {PlannedCollection[]}
 */
export const COLLECTIONS = [
    {
        owner: "demo",
        name: "Evening by the sea",
        description: "The first collection of the demo",
        tags: ["Sunsets"],
        files: [{ media: "sunset", lastModified: "2024-06-21T21:30:00Z" }]
    }
];

/** The name a planned file is uploaded under */
export function fileName(file) {
    return file.name ?? MEDIA[file.media].name;
}

/**
 * Which files a collection must hold to match: anything, at least one video,
 * photos and no videos, or videos and no photos
 */
export type CollectionFileType =
    | "any"
    | "hasVideos"
    | "photosOnly"
    | "videosOnly";

export const COLLECTION_FILE_TYPES: readonly CollectionFileType[] = [
    "any",
    "hasVideos",
    "photosOnly",
    "videosOnly"
];

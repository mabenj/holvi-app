/** A tag and how many of the user's collections, or files, have it */
export interface TagCount {
    name: string;
    count: number;
}

/** What tags are counted on: the user's collections or their files */
export type TagScope = "collections" | "files";

/** The longest a tag can be, in characters */
export const TAG_MAX_LENGTH = 50;

export const TAG_SCOPES: readonly TagScope[] = ["collections", "files"];

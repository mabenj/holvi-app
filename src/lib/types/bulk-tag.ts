import type { TagScope } from "./tag-count";

/** Tag changes for a selection of the user's collections, or of their files */
export interface BulkTagChanges {
    /** What the ids are: collections or files */
    target: TagScope;
    ids: string[];
    /** Tags to put on every one of them */
    add: string[];
    /** Tags to take off every one of them */
    remove: string[];
}

/** Each collection's or file's tags after a bulk tag change, by its id */
export type TagsById = Record<string, string[]>;

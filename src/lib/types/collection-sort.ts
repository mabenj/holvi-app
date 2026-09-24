/**
 * The orders of a user's collections: random for the Shuffle period, by Last
 * added to, by Last opened, by Open count, or by name
 */
export type CollectionSort =
    | "random"
    | "lastAddedTo"
    | "recentlyOpened"
    | "mostOpened"
    | "name";

export const COLLECTION_SORTS: readonly CollectionSort[] = [
    "random",
    "lastAddedTo",
    "recentlyOpened",
    "mostOpened",
    "name"
];

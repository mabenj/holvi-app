/** The orders of a collection's files: by date, newest or oldest first, or by name */
export type FileSort = "newest" | "oldest" | "name";

export const FILE_SORTS: readonly FileSort[] = ["newest", "oldest", "name"];

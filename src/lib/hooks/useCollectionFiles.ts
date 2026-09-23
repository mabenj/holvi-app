import { fetchFilesPage } from "../client/collections";
import { FileSort } from "../types/file-sort";
import { usePagedFiles } from "./usePagedFiles";

/**
 * A collection's files that have every one of the tags, in the given order, a
 * page at a time. Changing the sort or the tags starts again from the first page.
 */
export function useCollectionFiles(
    collectionId: string,
    sort: FileSort,
    tags: string[]
) {
    return usePagedFiles(
        JSON.stringify([collectionId, sort, tags]),
        (cursor, signal) =>
            fetchFilesPage(collectionId, { sort, tags, cursor }, signal)
    );
}

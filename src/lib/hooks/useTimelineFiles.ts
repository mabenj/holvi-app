import { fetchTimelinePage } from "../client/collections";
import { usePagedFiles } from "./usePagedFiles";

/**
 * The Timeline: every file the user owns that has every one of the tags, on
 * the file or its collection, newest first, a page at a time. Changing the
 * tags starts again from the first page.
 */
export function useTimelineFiles(tags: string[]) {
    return usePagedFiles(JSON.stringify(["timeline", tags]), (cursor, signal) =>
        fetchTimelinePage({ tags, cursor }, signal)
    );
}

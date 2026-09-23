import { fetchTimelinePage } from "../client/collections";
import { usePagedFiles } from "./usePagedFiles";

/** The Timeline: every file the user owns, newest first, a page at a time */
export function useTimelineFiles() {
    return usePagedFiles("timeline", fetchTimelinePage);
}

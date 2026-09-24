import { useMemo, useSyncExternalStore } from "react";
import {
    fetchTimelinePage,
    FilesPage,
    timelineQueryKey
} from "../client/collections";
import { QueryPageCache } from "../client/query-page-cache";
import { getErrorMessage } from "../common/utilities";
import type { FileSummary } from "../types/file-summary";

export interface TimelineState {
    /** The tag filter: the Timeline shows the files that have every one of them */
    tags: string[];
    /** The tags' loaded pages */
    pages: FilesPage[];
    /** A page is being fetched */
    loading: boolean;
    error: string | null;
}

const INITIAL_STATE: TimelineState = {
    tags: [],
    pages: [],
    loading: false,
    error: null
};

/** Fetches a page of the Timeline: the one after the cursor, or the first without one */
export type FetchTimelinePage = (
    options: { tags: string[]; cursor?: string },
    signal: AbortSignal
) => Promise<FilesPage>;

/**
 * The Timeline's tag filter, its loaded pages and where the grid was scrolled
 * to. Every query (a set of tags) keeps its own pages, so coming back to it
 * shows them again instead of starting over. The tags come from the
 * Timeline's URL. The rest is kept in app memory only, so a full reload starts
 * from the top, while going back to the Timeline from a collection or another
 * tab returns to the same pages and place.
 */
export class TimelineBrowse {
    private state = INITIAL_STATE;
    /** The loaded pages of queries other than the current one, by query key */
    private readonly cachedPages = new QueryPageCache<FilesPage>();
    private request: AbortController | null = null;
    /** Where the grid was scrolled to when the user left it, until it is restored */
    private scrollPosition: number | null = null;
    /** Files were added or changed elsewhere, so the next visit starts afresh */
    private stale = false;
    private readonly listeners = new Set<() => void>();

    constructor(private readonly fetchPage: FetchTimelinePage) {}

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.state;

    getServerSnapshot = () => INITIAL_STATE;

    get hasMore() {
        const last = this.state.pages.at(-1);
        return !last || last.nextCursor !== null;
    }

    /**
     * Starts a visit to the Timeline: shows the pages already loaded, or
     * fetches the first page. After files were added or changed elsewhere,
     * the loaded pages are dropped and the Timeline starts again from the
     * top. Tags other than the last visit's, e.g. from the URL, show their
     * own files.
     */
    startVisit = (tags: string[] = this.state.tags) => {
        if (this.stale) {
            this.stale = false;
            this.abort();
            this.cachedPages.clear();
            this.scrollPosition = null;
            this.update({ tags, pages: [], loading: false, error: null });
        }
        this.changeTags(tags);
    };

    /**
     * Shows the files with these tags: the loaded pages if they are the
     * current tags; else their cached pages if they have any; else their
     * first page
     */
    changeTags = (tags: string[]) => {
        const key = timelineQueryKey(tags);
        const currentKey = timelineQueryKey(this.state.tags);
        if (key !== currentKey) {
            this.abort();
            const pages = this.cachedPages.swap(
                currentKey,
                this.state.pages,
                key
            );
            this.scrollPosition = null;
            this.update({ tags, pages, loading: false, error: null });
        } else if (JSON.stringify(tags) !== JSON.stringify(this.state.tags)) {
            // The same files, e.g. a tag in other case
            this.update({ tags });
        }
        if (this.state.pages.length === 0) this.loadMore();
    };

    /** Fetches the next page, unless one is on its way, none is left or the last attempt failed */
    loadMore = () => {
        if (this.state.loading || this.state.error || !this.hasMore) return;
        const cursor = this.state.pages.at(-1)?.nextCursor ?? undefined;
        void this.fetch(cursor, (page) => [...this.state.pages, page]);
    };

    /**
     * Fetches the first page again, e.g. after files' tags changed under a tag
     * filter; the loaded pages stay until it arrives. Other tags' pages may no
     * longer match, so they are dropped.
     */
    reload = () => {
        this.abort();
        this.cachedPages.clear();
        void this.fetch(undefined, (page) => [page]);
    };

    /**
     * Applies a change to the loaded files, e.g. after an edit, without
     * fetching them again. Other tags' pages may no longer match, so they are
     * dropped.
     */
    changeFiles = (change: (files: FileSummary[]) => FileSummary[]) => {
        this.cachedPages.clear();
        this.update({ pages: changePages(this.state.pages, change) });
    };

    /** Takes files out of every query's loaded pages, e.g. after they were deleted */
    remove = (removed: (file: FileSummary) => boolean) => {
        const change = (files: FileSummary[]) =>
            files.filter((file) => !removed(file));
        this.cachedPages.change((pages) => changePages(pages, change));
        this.update({ pages: changePages(this.state.pages, change) });
    };

    /**
     * Files were added or changed elsewhere, so the next visit starts again
     * from the top. A visit in progress keeps what it shows.
     */
    forget = () => {
        this.stale = true;
    };

    /** Remembers where the grid is scrolled to, as the user leaves it */
    saveScrollPosition = (scrollY: number) => {
        this.scrollPosition = scrollY;
    };

    /** Where to scroll back to once the loaded pages are shown again, if anywhere; asked once */
    takeScrollPosition = () => {
        const position = this.scrollPosition;
        this.scrollPosition = null;
        return this.state.pages.length > 0 ? position : null;
    };

    /** Tries the failed page again */
    retry = () => {
        this.update({ error: null });
        this.loadMore();
    };

    /** Stops the page on its way, if any */
    abort = () => {
        this.request?.abort();
    };

    private async fetch(
        cursor: string | undefined,
        nextPages: (page: FilesPage) => FilesPage[]
    ) {
        const request = new AbortController();
        this.request = request;
        this.update({ loading: true, error: null });
        try {
            const page = await this.fetchPage(
                { tags: this.state.tags, cursor },
                request.signal
            );
            // Other tags or a reload can replace this request after its response arrived
            if (request.signal.aborted) return;
            this.update({ pages: nextPages(page), loading: false });
        } catch (error) {
            if (request.signal.aborted) return;
            this.update({ loading: false, error: getErrorMessage(error) });
        } finally {
            if (this.request === request) this.request = null;
        }
    }

    private update(changes: Partial<TimelineState>) {
        this.state = { ...this.state, ...changes };
        this.listeners.forEach((listener) => listener());
    }
}

function changePages(
    pages: FilesPage[],
    change: (files: FileSummary[]) => FileSummary[]
) {
    return pages.map((page) => ({ ...page, files: change(page.files) }));
}

/** The Timeline of the signed-in user; another user who signs in on this tab starts afresh */
let current: { userId: string; timeline: TimelineBrowse } | null = null;

function timelineFor(userId: string) {
    if (current?.userId !== userId) {
        current?.timeline.abort();
        current = { userId, timeline: new TimelineBrowse(fetchTimelinePage) };
    }
    return current.timeline;
}

/** Takes files deleted elsewhere, e.g. on a collection page, off the Timeline */
export function removeFromTimeline(
    userId: string,
    removed: (file: FileSummary) => boolean
) {
    timelineFor(userId).remove(removed);
}

/**
 * Files were added or changed elsewhere, e.g. uploaded or retagged, so the
 * Timeline starts again from the top on its next visit
 */
export function forgetTimeline(userId: string) {
    timelineFor(userId).forget();
}

/**
 * The Timeline: every file the user owns that has every one of the tags, on
 * the file or its collection, newest first, a page at a time
 */
export function useTimelineFiles(userId: string) {
    const timeline = timelineFor(userId);
    const state = useSyncExternalStore(
        timeline.subscribe,
        timeline.getSnapshot,
        timeline.getServerSnapshot
    );
    // The same array until the pages change, so the grid can memoize on it
    const files = useMemo(
        () => state.pages.flatMap((page) => page.files),
        [state.pages]
    );
    return {
        ...state,
        files,
        hasMore: timeline.hasMore,
        startVisit: timeline.startVisit,
        changeTags: timeline.changeTags,
        loadMore: timeline.loadMore,
        reload: timeline.reload,
        changeFiles: timeline.changeFiles,
        remove: timeline.remove,
        saveScrollPosition: timeline.saveScrollPosition,
        takeScrollPosition: timeline.takeScrollPosition,
        retry: timeline.retry
    };
}

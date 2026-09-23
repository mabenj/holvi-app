import { useSyncExternalStore } from "react";
import { CollectionsPage, fetchCollectionsPage } from "../client/collections";
import { getErrorMessage } from "../common/utilities";

export interface CollectionsBrowseState {
    pages: CollectionsPage[];
    /** A page is being fetched */
    loading: boolean;
    /** A refresh is fetching the new first page; the old pages stay until it arrives */
    refreshing: boolean;
    error: string | null;
}

const INITIAL_STATE: CollectionsBrowseState = {
    pages: [],
    loading: false,
    refreshing: false,
    error: null
};

/**
 * The Collections tab's loaded pages, the Shuffle seed they were fetched with
 * and where the grid was scrolled to. The tab has one query so far (random
 * order with this seed), so these are that query's cached pages. Kept in app
 * memory only, so a full reload starts from the current Shuffle period's order,
 * while going back from a collection returns to the same pages and place.
 */
class CollectionsBrowse {
    private state = INITIAL_STATE;
    /** Sent with every page after the first, so one scroll keeps one order */
    private seed: string | undefined;
    private request: AbortController | null = null;
    /** Where the grid was scrolled to when the user left it, until it is restored */
    private scrollPosition: number | null = null;
    private readonly listeners = new Set<() => void>();

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

    /** Fetches the first page, unless pages are loaded already, e.g. when coming back to the tab */
    loadFirstPage = () => {
        if (this.state.pages.length === 0) this.loadMore();
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

    /** Fetches the next page, unless one is on its way, none is left or the last attempt failed */
    loadMore = () => {
        if (this.state.loading || this.state.error || !this.hasMore) return;
        const cursor = this.state.pages.at(-1)?.nextCursor ?? undefined;
        void this.fetchPage(cursor, (page) => [...this.state.pages, page]);
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

    /** Drops the held seed and starts again from the first page */
    refresh = () => {
        this.abort();
        this.seed = undefined;
        this.scrollPosition = null;
        this.update({ refreshing: true });
        void this.fetchPage(undefined, (page) => [page]);
    };

    private async fetchPage(
        cursor: string | undefined,
        nextPages: (page: CollectionsPage) => CollectionsPage[]
    ) {
        const request = new AbortController();
        this.request = request;
        this.update({ loading: true, error: null });
        try {
            const page = await fetchCollectionsPage(
                { seed: this.seed, cursor },
                request.signal
            );
            // A refresh can replace this request after its response arrived
            if (request.signal.aborted) return;
            this.seed = page.seed;
            this.update({
                pages: nextPages(page),
                loading: false,
                refreshing: false
            });
        } catch (error) {
            if (request.signal.aborted) return;
            this.update({
                loading: false,
                refreshing: false,
                error: getErrorMessage(error)
            });
        } finally {
            if (this.request === request) this.request = null;
        }
    }

    private update(changes: Partial<CollectionsBrowseState>) {
        this.state = { ...this.state, ...changes };
        this.listeners.forEach((listener) => listener());
    }
}

/** The browse of the signed-in user; another user who signs in on this tab starts afresh */
let current: { userId: string; browse: CollectionsBrowse } | null = null;

function browseFor(userId: string) {
    if (current?.userId !== userId) {
        current?.browse.abort();
        current = { userId, browse: new CollectionsBrowse() };
    }
    return current.browse;
}

/** The user's collections in random order, a page at a time */
export function useCollectionsBrowse(userId: string) {
    const browse = browseFor(userId);
    const state = useSyncExternalStore(
        browse.subscribe,
        browse.getSnapshot,
        browse.getServerSnapshot
    );
    return {
        ...state,
        hasMore: browse.hasMore,
        loadMore: browse.loadMore,
        loadFirstPage: browse.loadFirstPage,
        saveScrollPosition: browse.saveScrollPosition,
        takeScrollPosition: browse.takeScrollPosition,
        retry: browse.retry,
        refresh: browse.refresh
    };
}

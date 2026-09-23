import { useSyncExternalStore } from "react";
import {
    CollectionsFilter,
    CollectionsPage,
    collectionsFilterKey,
    fetchCollectionsPage,
    NO_COLLECTIONS_FILTER
} from "../client/collections";
import { getErrorMessage } from "../common/utilities";

export interface CollectionsBrowseState {
    /** What the tab shows: the collections that match it */
    filter: CollectionsFilter;
    /** The filter's loaded pages */
    pages: CollectionsPage[];
    /** A page is being fetched */
    loading: boolean;
    /** A refresh is fetching the new first page; the old pages stay until it arrives */
    refreshing: boolean;
    error: string | null;
}

const INITIAL_STATE: CollectionsBrowseState = {
    filter: NO_COLLECTIONS_FILTER,
    pages: [],
    loading: false,
    refreshing: false,
    error: null
};

/** Pages of this many other filters stay cached, the most recently shown ones */
const CACHED_FILTERS = 10;

/**
 * The Collections tab's filter, its loaded pages, the Shuffle seed they were
 * fetched with and where the grid was scrolled to. Every filter keeps its own
 * pages, so coming back to it shows them again instead of starting over. One
 * seed serves every filter, so they all share one random order. Kept in app
 * memory only, so a full reload starts from the current Shuffle period's order,
 * while going back from a collection returns to the same filter, pages and place.
 */
class CollectionsBrowse {
    private state = INITIAL_STATE;
    /** Sent with every page after the first, so one scroll keeps one order */
    private seed: string | undefined;
    /** The loaded pages of filters other than the current one, by filter key */
    private readonly cachedPages = new Map<string, CollectionsPage[]>();
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

    /**
     * Changes the filter, e.g. only its search, and shows the collections that
     * match: the new filter's cached pages if it has any, or else its first page
     */
    changeFilter = (changes: Partial<CollectionsFilter>) => {
        const filter = { ...this.state.filter, ...changes };
        const key = collectionsFilterKey(filter);
        const currentKey = collectionsFilterKey(this.state.filter);
        if (key === currentKey) {
            this.update({ filter });
            return;
        }
        this.abort();
        if (this.state.pages.length > 0) {
            this.cachedPages.set(currentKey, this.state.pages);
        }
        const pages = this.cachedPages.get(key) ?? [];
        this.cachedPages.delete(key);
        // The least recently shown filters go first
        const oldestFirst = Array.from(this.cachedPages.keys());
        oldestFirst
            .slice(0, Math.max(0, oldestFirst.length - CACHED_FILTERS))
            .forEach((oldKey) => this.cachedPages.delete(oldKey));
        this.scrollPosition = null;
        this.update({
            filter,
            pages,
            loading: false,
            refreshing: false,
            error: null
        });
        this.loadFirstPage();
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

    /** Drops the held seed and every filter's pages, and starts again from the first page */
    refresh = () => {
        this.abort();
        this.seed = undefined;
        this.cachedPages.clear();
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
                { filter: this.state.filter, seed: this.seed, cursor },
                request.signal
            );
            // A refresh or another filter can replace this request after its response arrived
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

/** The user's collections that match the tab's filter, in random order, a page at a time */
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
        changeFilter: browse.changeFilter,
        saveScrollPosition: browse.saveScrollPosition,
        takeScrollPosition: browse.takeScrollPosition,
        retry: browse.retry,
        refresh: browse.refresh
    };
}

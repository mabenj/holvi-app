import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { FilesPage } from "../client/collections";
import { getErrorMessage } from "../common/utilities";

interface PagedFilesState {
    /** The query these pages belong to */
    query: string;
    pages: FilesPage[];
    loading: boolean;
    error: string | null;
}

/** Fetches the page after the cursor, or the first page without one */
export type FetchFilesPage = (
    cursor: string | undefined,
    signal: AbortSignal
) => Promise<FilesPage>;

/**
 * Files a page at a time behind keyset cursors. `query` names what is being
 * browsed: a new query starts again from the first page, and pages of an
 * earlier query are never shown while it loads. `fetchPage` fetches for the
 * current query.
 */
export function usePagedFiles(query: string, fetchPage: FetchFilesPage) {
    const [state, setState] = useState<PagedFilesState>({
        query,
        pages: [],
        loading: false,
        error: null
    });
    const current: PagedFilesState =
        state.query === query
            ? state
            : { query, pages: [], loading: false, error: null };
    const request = useRef<AbortController | null>(null);
    // The latest fetch, so a new function each render does not re-create loadMore
    const fetchRef = useRef(fetchPage);
    useLayoutEffect(() => {
        fetchRef.current = fetchPage;
    });

    const last = current.pages.at(-1);
    const hasMore = !last || last.nextCursor !== null;
    const cursor = last?.nextCursor ?? undefined;
    const canLoad = !current.loading && !current.error && hasMore;

    const loadMore = useCallback(() => {
        if (!canLoad) return;
        const controller = new AbortController();
        request.current?.abort();
        request.current = controller;
        setState((previous) => ({
            ...(previous.query === query
                ? previous
                : { query, pages: [], error: null }),
            loading: true
        }));
        fetchRef
            .current(cursor, controller.signal)
            .then((page) => {
                if (controller.signal.aborted) return;
                setState((previous) => ({
                    query,
                    pages: [...previous.pages, page],
                    loading: false,
                    error: null
                }));
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                setState((previous) => ({
                    ...previous,
                    loading: false,
                    error: getErrorMessage(error)
                }));
            });
    }, [canLoad, cursor, query]);

    // Leaving the screen or changing the query drops the page on its way
    useEffect(() => () => request.current?.abort(), [query]);

    /** Fetches the first page again, e.g. after an upload; the loaded pages stay until it arrives */
    const reload = useCallback(() => {
        const controller = new AbortController();
        request.current?.abort();
        request.current = controller;
        fetchRef
            .current(undefined, controller.signal)
            .then((page) => {
                if (controller.signal.aborted) return;
                setState({ query, pages: [page], loading: false, error: null });
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                setState((previous) => ({
                    ...previous,
                    loading: false,
                    error: getErrorMessage(error)
                }));
            });
    }, [query]);

    const retry = useCallback(() => {
        setState((previous) => ({ ...previous, error: null }));
    }, []);

    // The same array until a page arrives, so grids can memoize on it
    const files = useMemo(
        () => current.pages.flatMap((page) => page.files),
        [current.pages]
    );

    return {
        pages: current.pages,
        files,
        loading: current.loading,
        error: current.error,
        hasMore,
        loadMore,
        reload,
        retry
    };
}

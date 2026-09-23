import { useCallback, useEffect, useRef, useState } from "react";
import { FilesPage, fetchFilesPage } from "../client/collections";
import { getErrorMessage } from "../common/utilities";
import { FileSort } from "../types/file-sort";

interface FilesState {
    /** The collection, sort and tags these pages belong to */
    query: string;
    pages: FilesPage[];
    loading: boolean;
    error: string | null;
}

function queryKey(collectionId: string, sort: FileSort, tags: string[]) {
    return JSON.stringify([collectionId, sort, tags]);
}

/**
 * A collection's files that have every one of the tags, in the given order, a
 * page at a time. Changing the sort or the tags starts again from the first page.
 */
export function useCollectionFiles(
    collectionId: string,
    sort: FileSort,
    tags: string[]
) {
    const query = queryKey(collectionId, sort, tags);
    const [state, setState] = useState<FilesState>({
        query,
        pages: [],
        loading: false,
        error: null
    });
    // Pages of an earlier query are never shown while the new one loads
    const current: FilesState =
        state.query === query
            ? state
            : { query, pages: [], loading: false, error: null };
    const request = useRef<AbortController | null>(null);

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
        fetchFilesPage(collectionId, { sort, tags, cursor }, controller.signal)
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
        // The query key stands for the tags
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canLoad, collectionId, sort, cursor, query]);

    // Leaving the collection or changing the sort or tags drops the page on its way
    useEffect(() => () => request.current?.abort(), [query]);

    /** Fetches the first page again, e.g. after an upload; the loaded pages stay until it arrives */
    const reload = useCallback(() => {
        const controller = new AbortController();
        request.current?.abort();
        request.current = controller;
        fetchFilesPage(collectionId, { sort, tags }, controller.signal)
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
        // The query key stands for the tags
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionId, sort, query]);

    const retry = useCallback(() => {
        setState((previous) => ({ ...previous, error: null }));
    }, []);

    return {
        pages: current.pages,
        files: current.pages.flatMap((page) => page.files),
        loading: current.loading,
        error: current.error,
        hasMore,
        loadMore,
        reload,
        retry
    };
}

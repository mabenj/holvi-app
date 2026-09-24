import Router, { useRouter } from "next/router";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore
} from "react";
import {
    collectionsFilterParams,
    hasQueryChanges,
    parseCollectionsFilter,
    parseSortParam,
    parseTagsParam,
    QueryChanges,
    tagsParam,
    withQueryChanges
} from "../client/browse-query";
import type { CollectionsFilter } from "../client/collections";
import {
    chosenSortParam,
    COLLECTION_SORT_MEMORY,
    FILE_SORT_MEMORY,
    readRememberedSort,
    rememberSort,
    resolveSort,
    SortMemory,
    subscribeToRememberedSorts
} from "../client/remembered-sorts";
import { selectionEntryLeft } from "./useSelection";

/** Changes to the sort and filters neither reload the page nor scroll it */
const IN_PLACE = { shallow: true, scroll: false } as const;

/**
 * Changes parameters of the current URL in place of its history entry, never
 * as a new one, so Back still leaves the page. It waits for Back to leave
 * selection mode's entry first, e.g. when a filter change ends a selection.
 */
async function replaceQuery(changes: QueryChanges) {
    await selectionEntryLeft();
    if (!hasQueryChanges(Router.query, changes)) return;
    await Router.replace(
        {
            pathname: Router.pathname,
            query: withQueryChanges(Router.query, changes)
        },
        undefined,
        IN_PLACE
    ).catch(() => {
        // Another change replaced it on the way
    });
}

/** Changes the tag filter in the URL, in place */
function replaceTags(tags: string[]) {
    void replaceQuery(tagsParam(tags));
}

/**
 * Keeps the URL's parameters as they should read: e.g. the remembered sort
 * written in, and values that are not valid or at their default taken out.
 * Null while that is not yet known.
 */
function useCanonicalQuery(canonical: QueryChanges | null) {
    const { query } = useRouter();
    const differs = canonical !== null && hasQueryChanges(query, canonical);
    // The latest, with its undefined values, which take parameters out
    const latest = useRef(canonical);
    useLayoutEffect(() => {
        latest.current = canonical;
    });
    const key = JSON.stringify(canonical);
    useEffect(() => {
        if (differs && latest.current) void replaceQuery(latest.current);
    }, [differs, key]);
}

/** Server rendering and hydration cannot read browser storage, so the remembered sort is not known yet */
const NOT_KNOWN = null;

/** The remembered sort, undefined when there is none, or null until it can be read */
function useRememberedSort<S extends string>(memory: SortMemory<S>) {
    return useSyncExternalStore<S | undefined | typeof NOT_KNOWN>(
        subscribeToRememberedSorts,
        () => readRememberedSort(memory),
        () => NOT_KNOWN
    );
}

/**
 * The sort in the URL, or else the remembered one, or else the built-in one.
 * `sortKnown` is false until the remembered sort can be read, during hydration.
 */
function useSortQuery<S extends string>(memory: SortMemory<S>) {
    const { query } = useRouter();
    const remembered = useRememberedSort(memory);
    const sortKnown = remembered !== NOT_KNOWN;
    const { sort, param } = resolveSort(
        parseSortParam(query, memory.sorts),
        remembered ?? undefined,
        memory.builtIn
    );

    /** A choice in the sort control, which the browser remembers */
    const chooseSort = useCallback(
        (sort: S) => {
            // Remembered first: with no sort in the URL, the remembered one applies
            rememberSort(memory, sort);
            void replaceQuery({ sort: chosenSortParam(sort, memory.builtIn) });
        },
        [memory]
    );

    return { sortKnown, sort, param, chooseSort };
}

/** The same array for the same tags, so effects and memos can depend on it */
function useTagsParam() {
    const { query } = useRouter();
    const tags = parseTagsParam(query);
    const key = JSON.stringify(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => tags, [key]);
}

/**
 * The Collections tab's sort and filter, from the URL, which changing them
 * updates in place. Without a sort in the URL, the remembered sort applies.
 */
export function useCollectionsQuery() {
    const { query } = useRouter();
    const { sortKnown, sort, param, chooseSort } = useSortQuery(
        COLLECTION_SORT_MEMORY
    );
    const parsed = parseCollectionsFilter(query);
    const filterKey = JSON.stringify(parsed);
    const filter: CollectionsFilter = useMemo(
        () => JSON.parse(filterKey),
        [filterKey]
    );

    useCanonicalQuery(
        sortKnown
            ? { sort: param, ...collectionsFilterParams(filter) }
            : null
    );

    const changeFilter = useCallback(
        (changes: Partial<CollectionsFilter>) =>
            void replaceQuery(
                collectionsFilterParams({ ...filter, ...changes })
            ),
        [filter]
    );

    return { sortKnown, sort, filter, changeFilter, chooseSort };
}

/**
 * A collection page's file sort and tag filter, from the URL, which changing
 * them updates in place. Without a sort in the URL, the remembered file sort
 * applies.
 */
export function useCollectionFilesQuery() {
    const { sortKnown, sort, param, chooseSort } = useSortQuery(FILE_SORT_MEMORY);
    const tags = useTagsParam();

    useCanonicalQuery(
        sortKnown ? { sort: param, ...tagsParam(tags) } : null
    );

    return { sortKnown, sort, tags, changeTags: replaceTags, chooseSort };
}

/** The Timeline's tag filter, from the URL, which changing it updates in place */
export function useTimelineQuery() {
    const tags = useTagsParam();

    useCanonicalQuery(tagsParam(tags));

    return { tags, changeTags: replaceTags };
}

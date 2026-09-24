import { COLLECTION_SORTS, CollectionSort } from "../types/collection-sort";
import { FILE_SORTS, FileSort } from "../types/file-sort";

/**
 * A sort the browser remembers: the one the user last chose in a sort control.
 * It applies where the URL names no sort.
 */
export interface SortMemory<S extends string> {
    /** Where the browser keeps it */
    storageKey: string;
    sorts: readonly S[];
    /** The sort with nothing in the URL and nothing remembered */
    builtIn: S;
}

/** The Collections tab's sort */
export const COLLECTION_SORT_MEMORY: SortMemory<CollectionSort> = {
    storageKey: "holvi.collectionSort",
    sorts: COLLECTION_SORTS,
    builtIn: "random"
};

/** The file sort, one for every collection page */
export const FILE_SORT_MEMORY: SortMemory<FileSort> = {
    storageKey: "holvi.fileSort",
    sorts: FILE_SORTS,
    builtIn: "newest"
};

/** The sort a screen shows, and the `sort` its URL should carry, if any */
export interface ResolvedSort<S extends string> {
    sort: S;
    param: S | undefined;
}

/**
 * Which sort applies: the URL's wins; without one, the remembered sort, which
 * the URL then carries too; without either, the built-in sort, which the URL
 * leaves out. A remembered sort that is the built-in one is left out as well,
 * so random is never written.
 */
export function resolveSort<S extends string>(
    fromUrl: S | undefined,
    remembered: S | undefined,
    builtIn: S
): ResolvedSort<S> {
    if (fromUrl !== undefined) return { sort: fromUrl, param: fromUrl };
    if (remembered !== undefined && remembered !== builtIn) {
        return { sort: remembered, param: remembered };
    }
    return { sort: builtIn, param: undefined };
}

/**
 * The `sort` the URL carries once the user chooses a sort in the sort
 * control, which also remembers it: none for the built-in sort, since with
 * nothing in the URL the remembered sort applies, and that is now it
 */
export function chosenSortParam<S extends string>(
    chosen: S,
    builtIn: S
): S | undefined {
    return chosen === builtIn ? undefined : chosen;
}

/** Tells this tab's screens that the user chose a sort */
const CHANGE_EVENT = "holvi:remembered-sort";

/** The remembered sort, or undefined if none is, or the browser cannot keep one */
export function readRememberedSort<S extends string>(
    memory: SortMemory<S>
): S | undefined {
    try {
        const stored = window.localStorage.getItem(memory.storageKey);
        return memory.sorts.find((sort) => sort === stored);
    } catch {
        // Storage can be unavailable, e.g. in some private windows
        return undefined;
    }
}

/** Remembers the sort the user chose in a sort control */
export function rememberSort<S extends string>(memory: SortMemory<S>, sort: S) {
    try {
        window.localStorage.setItem(memory.storageKey, sort);
    } catch {
        // Without storage the choice cannot be remembered
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Calls back when the user chooses a sort in this tab. One chosen in another
 * browser tab is not announced, so it does not reorder this tab's screen
 * there and then.
 */
export function subscribeToRememberedSorts(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

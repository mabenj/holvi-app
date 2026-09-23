import type { CollectionDetails } from "../types/collection-details";
import type { CollectionFileType } from "../types/collection-file-type";
import type { CollectionSummary } from "../types/collection-summary";
import type { FileSort } from "../types/file-sort";
import type { FileSummary } from "../types/file-summary";

export interface CollectionsPage {
    collections: CollectionSummary[];
    nextCursor: string | null;
    seed: string;
}

/** What narrows the Collections tab: tags (all of them), file type and a name search */
export interface CollectionsFilter {
    tags: string[];
    fileType: CollectionFileType;
    q: string;
}

export const NO_COLLECTIONS_FILTER: CollectionsFilter = {
    tags: [],
    fileType: "any",
    q: ""
};

/** Whether the filter leaves out any collections */
export function isFiltering(filter: CollectionsFilter) {
    return (
        filter.tags.length > 0 || filter.fileType !== "any" || !!filter.q.trim()
    );
}

/** The same key for filters that match the same collections */
export function collectionsFilterKey(filter: CollectionsFilter) {
    return JSON.stringify([
        filter.tags.map((tag) => tag.toLowerCase()).sort(),
        filter.fileType,
        filter.q.trim().toLowerCase()
    ]);
}

export interface FilesPage {
    files: FileSummary[];
    nextCursor: string | null;
}

/** GETs an API route's JSON, throwing the route's error message, or `failure`, when it fails */
async function getJson(
    url: string,
    failure: string,
    options: { signal?: AbortSignal; notFound?: string } = {}
) {
    const res = await fetch(url, { signal: options.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            (res.status === 404 && options.notFound) || data.error || failure
        );
    }
    return data;
}

/** One page of the user's collections that match the filter, in random order */
export async function fetchCollectionsPage(
    options: { filter: CollectionsFilter; seed?: string; cursor?: string },
    signal?: AbortSignal
): Promise<CollectionsPage> {
    const { tags, fileType, q } = options.filter;
    const params = new URLSearchParams({ sort: "random" });
    tags.forEach((tag) => params.append("tags", tag));
    if (fileType !== "any") params.set("fileType", fileType);
    if (q.trim()) params.set("q", q.trim());
    if (options.seed) params.set("seed", options.seed);
    if (options.cursor) params.set("cursor", options.cursor);
    const data = await getJson(
        `/api/collections?${params}`,
        "Could not load collections",
        { signal }
    );
    return {
        collections: data.collections,
        nextCursor: data.nextCursor,
        seed: data.seed
    };
}

export function collectionUrl(collectionId: string) {
    return `/api/collections/${encodeURIComponent(collectionId)}`;
}

/** One of the user's collections, with its description */
export async function fetchCollection(
    collectionId: string
): Promise<CollectionDetails> {
    const data = await getJson(
        collectionUrl(collectionId),
        "Could not load the collection",
        { notFound: "This collection does not exist" }
    );
    return data.collection;
}

/** One page of a collection's files that have every one of the tags, in the given order */
export async function fetchFilesPage(
    collectionId: string,
    options: { sort: FileSort; tags: string[]; cursor?: string },
    signal?: AbortSignal
): Promise<FilesPage> {
    const params = new URLSearchParams({ sort: options.sort });
    options.tags.forEach((tag) => params.append("tags", tag));
    if (options.cursor) params.set("cursor", options.cursor);
    const data = await getJson(
        `${collectionUrl(collectionId)}/files?${params}`,
        "Could not load the files",
        { signal }
    );
    return { files: data.files, nextCursor: data.nextCursor };
}

/** One page of the Timeline: every file the user owns, newest first */
export async function fetchTimelinePage(
    cursor: string | undefined,
    signal?: AbortSignal
): Promise<FilesPage> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const data = await getJson(
        `/api/files?${params}`,
        "Could not load the Timeline",
        { signal }
    );
    return { files: data.files, nextCursor: data.nextCursor };
}

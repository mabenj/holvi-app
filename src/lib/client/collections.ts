import type { CollectionDetails } from "../types/collection-details";
import type { CollectionSummary } from "../types/collection-summary";
import type { FileSort } from "../types/file-sort";
import type { FileSummary } from "../types/file-summary";

export interface CollectionsPage {
    collections: CollectionSummary[];
    nextCursor: string | null;
    seed: string;
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

/** One page of the user's collections in random order */
export async function fetchCollectionsPage(
    options: { seed?: string; cursor?: string },
    signal?: AbortSignal
): Promise<CollectionsPage> {
    const params = new URLSearchParams({ sort: "random" });
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

/** One page of a collection's files in the given order */
export async function fetchFilesPage(
    collectionId: string,
    options: { sort: FileSort; cursor?: string },
    signal?: AbortSignal
): Promise<FilesPage> {
    const params = new URLSearchParams({ sort: options.sort });
    if (options.cursor) params.set("cursor", options.cursor);
    const data = await getJson(
        `${collectionUrl(collectionId)}/files?${params}`,
        "Could not load the files",
        { signal }
    );
    return { files: data.files, nextCursor: data.nextCursor };
}

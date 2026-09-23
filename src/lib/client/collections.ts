import type { CollectionDetails } from "../types/collection-details";
import type { CollectionSummary } from "../types/collection-summary";
import type { FileSort } from "../types/file-sort";
import type { FileSummary } from "../types/file-summary";

export interface CollectionsPage {
    collections: CollectionSummary[];
    nextCursor: string | null;
    seed: string;
}

/** One page of the user's collections in random order */
export async function fetchCollectionsPage(
    options: { seed?: string; cursor?: string },
    signal?: AbortSignal
): Promise<CollectionsPage> {
    const params = new URLSearchParams({ sort: "random" });
    if (options.seed) params.set("seed", options.seed);
    if (options.cursor) params.set("cursor", options.cursor);
    const res = await fetch(`/api/collections?${params}`, { signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Could not load collections");
    }
    return {
        collections: data.collections,
        nextCursor: data.nextCursor,
        seed: data.seed
    };
}

export interface FilesPage {
    files: FileSummary[];
    nextCursor: string | null;
}

export function collectionUrl(collectionId: string) {
    return `/api/collections/${encodeURIComponent(collectionId)}`;
}

/** One of the user's collections, with its description */
export async function fetchCollection(
    collectionId: string
): Promise<CollectionDetails> {
    const res = await fetch(collectionUrl(collectionId));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            res.status === 404
                ? "This collection does not exist"
                : data.error || "Could not load the collection"
        );
    }
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
    const res = await fetch(`${collectionUrl(collectionId)}/files?${params}`, {
        signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Could not load the files");
    }
    return { files: data.files, nextCursor: data.nextCursor };
}

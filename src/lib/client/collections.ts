import type { CollectionSummary } from "../types/collection-summary";

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

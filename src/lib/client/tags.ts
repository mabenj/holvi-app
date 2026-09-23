import type { TagCount, TagScope } from "../types/tag-count";

/** Where the user's tags and their counts are read from; also the SWR key */
export function tagCountsUrl(scope: TagScope, collectionId?: string) {
    const params = new URLSearchParams({ scope });
    if (collectionId) params.set("collectionId", collectionId);
    return `/api/tags?${params}`;
}

/** The user's collection or file tags with how many use each, most used first */
export async function fetchTagCounts(url: string): Promise<TagCount[]> {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Could not load tags");
    }
    return data.tags;
}

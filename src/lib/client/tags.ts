import { mutate } from "swr";
import type { BulkTagChanges, TagsById } from "../types/bulk-tag";
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

/** Adds and removes tags on every collection, or file, in a selection; each one's tags afterwards */
export async function bulkTag(changes: BulkTagChanges): Promise<TagsById> {
    // Plain text: the route parses the raw body itself
    const res = await fetch("/api/tags/bulk", {
        method: "POST",
        body: JSON.stringify(changes)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Could not change the tags");
    }
    return data.tags;
}

/** Fetches every tag count shown again, e.g. after tags changed */
export function revalidateTagCounts() {
    void mutate((key) => typeof key === "string" && key.startsWith("/api/tags?"));
}

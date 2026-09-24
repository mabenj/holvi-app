import { describe, expect, it } from "vitest";
import {
    CollectionsFilter,
    CollectionsPage,
    NO_COLLECTIONS_FILTER
} from "../client/collections";
import type { CollectionSort } from "../types/collection-sort";
import type { CollectionSummary } from "../types/collection-summary";
import { CollectionsBrowse, FetchCollectionsPage } from "./useCollectionsBrowse";

function collection(id: string): CollectionSummary {
    return {
        id,
        name: id,
        tags: [],
        imageCount: 0,
        videoCount: 0,
        thumbnails: [],
        cover: null,
        lastAddedTo: 0
    };
}

/** A fake collections API: one page per query, answered on demand */
function fakeCollections() {
    const requests: {
        sort: CollectionSort;
        filter: CollectionsFilter;
        seed?: string;
        resolve: (page: CollectionsPage) => void;
    }[] = [];
    const fetchPage: FetchCollectionsPage = (options) =>
        new Promise((resolve) => requests.push({ ...options, resolve }));
    /** Answers the oldest pending request with its query's page */
    const answer = async () => {
        const request = requests.shift();
        if (!request) throw new Error("No request to answer");
        const prefix = [request.sort, ...request.filter.tags].join("+");
        request.resolve({
            collections: [collection(`${prefix}-a`), collection(`${prefix}-b`)],
            nextCursor: null,
            seed: request.sort === "random" ? "seed-1" : undefined
        });
        await Promise.resolve();
        await Promise.resolve();
    };
    return { requests, fetchPage, answer };
}

const ids = (browse: CollectionsBrowse) =>
    browse
        .getSnapshot()
        .pages.flatMap((page) => page.collections.map((c) => c.id));

const tagged = (...tags: string[]) => ({ ...NO_COLLECTIONS_FILTER, tags });

describe("CollectionsBrowse", () => {
    it("comes back to the same pages and place when shown the query it was showing, e.g. going back to the tab", async () => {
        const api = fakeCollections();
        const browse = new CollectionsBrowse(api.fetchPage);
        browse.show("name", tagged("beach"));
        await api.answer();
        browse.saveScrollPosition(900);

        browse.show("name", tagged("Beach"));
        expect(api.requests).toHaveLength(0);
        expect(ids(browse)).toEqual(["name+beach-a", "name+beach-b"]);
        expect(browse.takeScrollPosition()).toBe(900);
        // The filter as the URL has it now
        expect(browse.getSnapshot().filter.tags).toEqual(["Beach"]);
    });

    it("shows another query's cached pages, or fetches its first page, from the top", async () => {
        const api = fakeCollections();
        const browse = new CollectionsBrowse(api.fetchPage);
        browse.show("name", NO_COLLECTIONS_FILTER);
        await api.answer();
        browse.show("mostOpened", NO_COLLECTIONS_FILTER);
        expect(ids(browse)).toEqual([]);
        await api.answer();
        browse.saveScrollPosition(400);

        browse.show("name", NO_COLLECTIONS_FILTER);
        expect(api.requests).toHaveLength(0);
        expect(ids(browse)).toEqual(["name-a", "name-b"]);
        expect(browse.takeScrollPosition()).toBeNull();
    });

    it("keeps the seed of the random order out of the query, across sorts", async () => {
        const api = fakeCollections();
        const browse = new CollectionsBrowse(api.fetchPage);
        browse.show("random", NO_COLLECTIONS_FILTER);
        expect(api.requests[0].seed).toBeUndefined();
        await api.answer();
        browse.show("name", NO_COLLECTIONS_FILTER);
        await api.answer();
        browse.show("random", tagged("beach"));
        expect(api.requests[0].seed).toBe("seed-1");
    });
});

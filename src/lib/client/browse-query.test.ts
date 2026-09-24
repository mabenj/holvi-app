import { describe, expect, it } from "vitest";
import {
    collectionsFilterParams,
    hasQueryChanges,
    parseCollectionsFilter,
    parseSortParam,
    parseTagsParam,
    tagsParam,
    withQueryChanges
} from "./browse-query";
import { NO_COLLECTIONS_FILTER } from "./collections";
import { COLLECTION_SORTS } from "../types/collection-sort";
import { FILE_SORTS } from "../types/file-sort";

describe("the Collections tab's filter in the URL", () => {
    it("is no filter when the URL has no parameters", () => {
        expect(parseCollectionsFilter({})).toEqual(NO_COLLECTIONS_FILTER);
    });

    it("reads every parameter", () => {
        expect(
            parseCollectionsFilter({
                tags: ["summer", "beach"],
                fileType: "videosOnly",
                forgotten: "true",
                q: "trip"
            })
        ).toEqual({
            tags: ["summer", "beach"],
            fileType: "videosOnly",
            forgotten: true,
            q: "trip"
        });
    });

    it("falls back to the default for values that are not valid", () => {
        expect(
            parseCollectionsFilter({
                fileType: "gifs",
                forgotten: "yes",
                q: ["a", "b"]
            })
        ).toEqual(NO_COLLECTIONS_FILTER);
        expect(
            parseCollectionsFilter({ fileType: ["hasVideos", "any"] })
        ).toEqual(NO_COLLECTIONS_FILTER);
    });

    it("keeps a search as typed, but a blank one is no search", () => {
        expect(parseCollectionsFilter({ q: "new york " }).q).toBe("new york ");
        expect(parseCollectionsFilter({ q: "   " }).q).toBe("");
    });

    it("leaves out parameters at their default", () => {
        expect(collectionsFilterParams(NO_COLLECTIONS_FILTER)).toEqual({
            tags: undefined,
            fileType: undefined,
            forgotten: undefined,
            q: undefined
        });
        expect(
            withQueryChanges({}, collectionsFilterParams(NO_COLLECTIONS_FILTER))
        ).toEqual({});
    });

    it("writes the filters that are on", () => {
        expect(
            collectionsFilterParams({
                tags: ["summer"],
                fileType: "hasVideos",
                forgotten: true,
                q: "trip"
            })
        ).toEqual({
            tags: ["summer"],
            fileType: "hasVideos",
            forgotten: "true",
            q: "trip"
        });
    });

    it("reads back what it writes", () => {
        const filter = {
            tags: ["b", "a"],
            fileType: "photosOnly" as const,
            forgotten: true,
            q: "old "
        };
        const query = withQueryChanges({}, collectionsFilterParams(filter));
        expect(parseCollectionsFilter(query)).toEqual(filter);
        expect(hasQueryChanges(query, collectionsFilterParams(filter))).toBe(
            false
        );
    });
});

describe("tags in the URL", () => {
    it("read a single tag and repeated tags", () => {
        expect(parseTagsParam({ tags: "summer" })).toEqual(["summer"]);
        expect(parseTagsParam({ tags: ["summer", "beach"] })).toEqual([
            "summer",
            "beach"
        ]);
    });

    it("drop empty tags and tags repeated in other case", () => {
        expect(
            parseTagsParam({ tags: ["Summer", "", " ", "summer", "beach"] })
        ).toEqual(["Summer", "beach"]);
    });

    it("are left out when there are none", () => {
        expect(tagsParam([])).toEqual({ tags: undefined });
        expect(tagsParam(["a"])).toEqual({ tags: ["a"] });
    });
});

describe("a sort in the URL", () => {
    it("is read when it is one of the screen's sorts", () => {
        expect(parseSortParam({ sort: "name" }, COLLECTION_SORTS)).toBe("name");
        expect(parseSortParam({ sort: "oldest" }, FILE_SORTS)).toBe("oldest");
    });

    it("is no sort when absent, repeated or not one of the screen's sorts", () => {
        expect(parseSortParam({}, COLLECTION_SORTS)).toBeUndefined();
        expect(
            parseSortParam({ sort: ["name", "random"] }, COLLECTION_SORTS)
        ).toBeUndefined();
        expect(
            parseSortParam({ sort: "oldest" }, COLLECTION_SORTS)
        ).toBeUndefined();
        expect(parseSortParam({ sort: "" }, FILE_SORTS)).toBeUndefined();
    });
});

describe("changing the URL's query", () => {
    it("sets and removes parameters and keeps the others, e.g. the lightbox's", () => {
        expect(
            withQueryChanges(
                { collectionId: "c1", photoId: "f1", sort: "name", tags: "a" },
                { sort: "oldest", tags: undefined }
            )
        ).toEqual({ collectionId: "c1", photoId: "f1", sort: "oldest" });
    });

    it("tells whether the changes would change anything", () => {
        expect(hasQueryChanges({ tags: "a" }, { tags: ["a"] })).toBe(false);
        expect(hasQueryChanges({ tags: "a" }, { tags: ["a", "b"] })).toBe(true);
        expect(hasQueryChanges({ sort: "name" }, { sort: undefined })).toBe(
            true
        );
        expect(hasQueryChanges({ photoId: "f1" }, { sort: undefined })).toBe(
            false
        );
    });
});

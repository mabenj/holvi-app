import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    chosenSortParam,
    COLLECTION_SORT_MEMORY,
    FILE_SORT_MEMORY,
    readRememberedSort,
    rememberSort,
    resolveSort
} from "./remembered-sorts";

describe("which sort applies", () => {
    it("is the URL's, whatever is remembered", () => {
        expect(resolveSort("name", "mostOpened", "random")).toEqual({
            sort: "name",
            param: "name"
        });
        expect(resolveSort("name", undefined, "random")).toEqual({
            sort: "name",
            param: "name"
        });
    });

    it("keeps a built-in sort named in the URL, which would otherwise give way to the remembered one", () => {
        expect(resolveSort("random", "name", "random")).toEqual({
            sort: "random",
            param: "random"
        });
    });

    it("takes a built-in sort named in the URL out when nothing else is remembered", () => {
        expect(resolveSort("random", undefined, "random")).toEqual({
            sort: "random",
            param: undefined
        });
        expect(resolveSort("newest", "newest", "newest")).toEqual({
            sort: "newest",
            param: undefined
        });
    });

    it("is the remembered one without a sort in the URL, which the URL then carries", () => {
        expect(resolveSort(undefined, "lastAddedTo", "random")).toEqual({
            sort: "lastAddedTo",
            param: "lastAddedTo"
        });
        expect(resolveSort(undefined, "oldest", "newest")).toEqual({
            sort: "oldest",
            param: "oldest"
        });
    });

    it("is the built-in one with neither, and the URL leaves it out", () => {
        expect(resolveSort(undefined, undefined, "random")).toEqual({
            sort: "random",
            param: undefined
        });
    });

    it("never writes a remembered built-in sort, such as random, into the URL", () => {
        expect(resolveSort(undefined, "random", "random")).toEqual({
            sort: "random",
            param: undefined
        });
        expect(resolveSort(undefined, "newest", "newest")).toEqual({
            sort: "newest",
            param: undefined
        });
    });
});

describe("choosing a sort in the sort control", () => {
    it("puts it in the URL, unless it is the built-in one", () => {
        expect(chosenSortParam("name", "random")).toBe("name");
        expect(chosenSortParam("random", "random")).toBeUndefined();
        expect(chosenSortParam("newest", "newest")).toBeUndefined();
    });
});

describe("remembering sorts", () => {
    let stored: Map<string, string>;

    beforeEach(() => {
        stored = new Map();
        vi.stubGlobal("window", {
            localStorage: {
                getItem: (key: string) => stored.get(key) ?? null,
                setItem: (key: string, value: string) => stored.set(key, value)
            },
            dispatchEvent: () => true
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("remembers one collection sort and one file sort", () => {
        expect(readRememberedSort(COLLECTION_SORT_MEMORY)).toBeUndefined();
        rememberSort(COLLECTION_SORT_MEMORY, "mostOpened");
        rememberSort(FILE_SORT_MEMORY, "name");
        expect(readRememberedSort(COLLECTION_SORT_MEMORY)).toBe("mostOpened");
        expect(readRememberedSort(FILE_SORT_MEMORY)).toBe("name");
    });

    it("ignores a stored value that is not a sort", () => {
        stored.set(COLLECTION_SORT_MEMORY.storageKey, "oldest");
        expect(readRememberedSort(COLLECTION_SORT_MEMORY)).toBeUndefined();
    });

    it("remembers nothing, without failing, when storage is unavailable", () => {
        vi.stubGlobal("window", {
            get localStorage(): Storage {
                throw new Error("SecurityError");
            },
            dispatchEvent: () => true
        });
        expect(() => rememberSort(FILE_SORT_MEMORY, "oldest")).not.toThrow();
        expect(readRememberedSort(FILE_SORT_MEMORY)).toBeUndefined();
    });
});

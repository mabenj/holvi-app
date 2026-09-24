import { describe, expect, it } from "vitest";
import type { FilesPage } from "../client/collections";
import type { FileSummary } from "../types/file-summary";
import { FetchTimelinePage, TimelineBrowse } from "./useTimelineFiles";

function file(id: string, collectionId = "c1"): FileSummary {
    return { id, collectionId } as FileSummary;
}

/** A fake Timeline API: two pages of files per tag filter, answered on demand */
function fakeTimeline() {
    const requests: {
        tags: string[];
        cursor?: string;
        signal: AbortSignal;
        resolve: (page: FilesPage) => void;
    }[] = [];
    const fetchPage: FetchTimelinePage = (options, signal) =>
        new Promise((resolve) => requests.push({ ...options, signal, resolve }));
    /** Answers the oldest pending request with its page */
    const answer = async () => {
        const request = requests.shift();
        if (!request) throw new Error("No request to answer");
        const prefix = request.tags.join("+") || "all";
        const pageIndex = request.cursor ? 2 : 1;
        request.resolve({
            files: [
                file(`${prefix}-${pageIndex}a`),
                file(`${prefix}-${pageIndex}b`, "c2")
            ],
            nextCursor: pageIndex === 1 ? `${prefix}-cursor` : null
        });
        await Promise.resolve();
        await Promise.resolve();
    };
    return { requests, fetchPage, answer };
}

const ids = (timeline: TimelineBrowse) =>
    timeline
        .getSnapshot()
        .pages.flatMap((page) => page.files.map((file) => file.id));

describe("TimelineBrowse", () => {
    it("fetches the first page on the first visit and keeps it for the next", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        await api.answer();
        expect(ids(timeline)).toEqual(["all-1a", "all-1b"]);

        timeline.startVisit();
        expect(api.requests).toHaveLength(0);
    });

    it("gives back the scroll position once, and only with pages to scroll through", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.saveScrollPosition(500);
        expect(timeline.takeScrollPosition()).toBeNull();

        timeline.startVisit();
        await api.answer();
        timeline.saveScrollPosition(1200);
        expect(timeline.takeScrollPosition()).toBe(1200);
        expect(timeline.takeScrollPosition()).toBeNull();
    });

    it("keeps each tag filter's pages, so going back to one shows them again", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        await api.answer();
        timeline.loadMore();
        await api.answer();

        timeline.changeTags(["beach"]);
        expect(ids(timeline)).toEqual([]);
        await api.answer();
        expect(ids(timeline)).toEqual(["beach-1a", "beach-1b"]);

        timeline.changeTags([]);
        expect(api.requests).toHaveLength(0);
        expect(ids(timeline)).toEqual([
            "all-1a",
            "all-1b",
            "all-2a",
            "all-2b"
        ]);
        expect(timeline.hasMore).toBe(false);
    });

    it("treats tags as case-insensitive and unordered", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.changeTags(["Beach", "sun"]);
        await api.answer();
        timeline.changeTags(["SUN", "beach"]);
        expect(api.requests).toHaveLength(0);
        expect(timeline.getSnapshot().tags).toEqual(["SUN", "beach"]);
    });

    it("forgets the scroll position when the tags change", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        await api.answer();
        timeline.saveScrollPosition(800);
        timeline.changeTags(["beach"]);
        await api.answer();
        expect(timeline.takeScrollPosition()).toBeNull();
    });

    it("drops a page for other tags that arrives after the tags changed", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        const first = api.requests[0];
        timeline.changeTags(["beach"]);
        expect(first.signal.aborted).toBe(true);
        await api.answer();
        await api.answer();
        expect(ids(timeline)).toEqual(["beach-1a", "beach-1b"]);
    });

    it("takes deleted files out of every tag filter's pages", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        await api.answer();
        timeline.changeTags(["beach"]);
        await api.answer();

        timeline.remove((f) => f.collectionId === "c2");
        expect(ids(timeline)).toEqual(["beach-1a"]);
        timeline.changeTags([]);
        expect(ids(timeline)).toEqual(["all-1a"]);
    });

    it("drops other tag filters' pages after an edit, which may change what they match", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.startVisit();
        await api.answer();
        timeline.changeTags(["beach"]);
        await api.answer();

        timeline.changeFiles((files) =>
            files.map((f) => ({ ...f, name: "renamed" }))
        );
        expect(
            timeline.getSnapshot().pages[0].files.map((f) => f.name)
        ).toEqual(["renamed", "renamed"]);
        timeline.changeTags([]);
        expect(api.requests).toHaveLength(1);
    });

    it("starts again from the top on the next visit after files changed elsewhere", async () => {
        const api = fakeTimeline();
        const timeline = new TimelineBrowse(api.fetchPage);
        timeline.changeTags(["beach"]);
        await api.answer();
        timeline.loadMore();
        await api.answer();
        timeline.saveScrollPosition(3000);

        timeline.forget();
        // The visit in progress keeps what it shows
        expect(ids(timeline)).toHaveLength(4);

        timeline.startVisit();
        expect(timeline.takeScrollPosition()).toBeNull();
        await api.answer();
        expect(timeline.getSnapshot().tags).toEqual(["beach"]);
        expect(ids(timeline)).toEqual(["beach-1a", "beach-1b"]);
    });
});

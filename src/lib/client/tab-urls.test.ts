import { describe, expect, it } from "vitest";
import { parseTabUrls, tabReturn } from "./tab-urls";

describe("coming back to a tab", () => {
    it("returns to its screen's URL with the sort and filters", () => {
        expect(tabReturn("/?sort=name&tags=a&tags=b")).toEqual({
            tab: "/",
            url: "/?sort=name&tags=a&tags=b"
        });
        expect(tabReturn("/timeline?tags=summer")).toEqual({
            tab: "/timeline",
            url: "/timeline?tags=summer"
        });
        expect(tabReturn("/settings")).toEqual({
            tab: "/settings",
            url: "/settings"
        });
    });

    it("leaves the lightbox and selection mode behind", () => {
        expect(tabReturn("/timeline?tags=a&photoId=f1")).toEqual({
            tab: "/timeline",
            url: "/timeline?tags=a"
        });
        expect(tabReturn("/?selecting=1")).toEqual({ tab: "/", url: "/" });
    });

    it("is not about screens that are no tab's own, such as a collection page", () => {
        expect(tabReturn("/collections/c1?sort=oldest")).toBeNull();
        expect(tabReturn("/login")).toBeNull();
    });
});

describe("the tab URLs kept for the session", () => {
    it("go to each tab's own path when none are kept", () => {
        expect(parseTabUrls(null)).toEqual({
            "/": "/",
            "/timeline": "/timeline",
            "/settings": "/settings"
        });
    });

    it("read back each tab's URL", () => {
        const kept = {
            "/": "/?sort=name",
            "/timeline": "/timeline?tags=a",
            "/settings": "/settings"
        };
        expect(parseTabUrls(JSON.stringify(kept))).toEqual(kept);
    });

    it("ignore what is not a tab's own screen, or not what was kept", () => {
        expect(
            parseTabUrls(
                JSON.stringify({
                    "/": "/timeline?tags=a",
                    "/timeline": 5,
                    "/settings": "https://example.com/settings"
                })
            )
        ).toEqual({
            "/": "/",
            "/timeline": "/timeline",
            "/settings": "/settings"
        });
        expect(parseTabUrls("not json")["/"]).toBe("/");
        expect(parseTabUrls("null")["/"]).toBe("/");
    });
});

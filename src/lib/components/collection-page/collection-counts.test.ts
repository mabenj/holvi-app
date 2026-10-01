import { describe, expect, it } from "vitest";
import { describeCounts } from "./collection-counts";

describe("describeCounts", () => {
    it("counts photos alone", () => {
        expect(describeCounts({ imageCount: 12, videoCount: 0 })).toBe(
            "12 photos"
        );
    });

    it("counts videos alone", () => {
        expect(describeCounts({ imageCount: 0, videoCount: 4 })).toBe(
            "4 videos"
        );
    });

    it("counts photos, then videos", () => {
        expect(describeCounts({ imageCount: 12, videoCount: 3 })).toBe(
            "12 photos · 3 videos"
        );
    });

    it("says one photo and one video in the singular", () => {
        expect(describeCounts({ imageCount: 1, videoCount: 0 })).toBe(
            "1 photo"
        );
        expect(describeCounts({ imageCount: 0, videoCount: 1 })).toBe(
            "1 video"
        );
        expect(describeCounts({ imageCount: 1, videoCount: 1 })).toBe(
            "1 photo · 1 video"
        );
    });

    it("says nothing for an empty collection", () => {
        expect(describeCounts({ imageCount: 0, videoCount: 0 })).toBeNull();
    });
});

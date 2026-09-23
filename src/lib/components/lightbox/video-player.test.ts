import { describe, expect, it } from "vitest";
import {
    formatPlaybackTime,
    fractionAtPointer,
    isTap,
    keyboardAction,
    scrubPreviewTile,
    seekTarget,
    skipZone
} from "./video-player";

describe("formatPlaybackTime", () => {
    it("shows minutes and seconds", () => {
        expect(formatPlaybackTime(0)).toBe("0:00");
        expect(formatPlaybackTime(9.9)).toBe("0:09");
        expect(formatPlaybackTime(75)).toBe("1:15");
        expect(formatPlaybackTime(59 * 60 + 59)).toBe("59:59");
    });

    it("adds hours for long videos", () => {
        expect(formatPlaybackTime(3600)).toBe("1:00:00");
        expect(formatPlaybackTime(2 * 3600 + 5 * 60 + 7)).toBe("2:05:07");
    });

    it("shows a placeholder while the duration is unknown", () => {
        expect(formatPlaybackTime(NaN)).toBe("-:--");
        expect(formatPlaybackTime(Infinity)).toBe("-:--");
    });
});

describe("fractionAtPointer", () => {
    const track = { left: 100, width: 200 };

    it("is how far along the track the pointer is", () => {
        expect(fractionAtPointer(100, track)).toBe(0);
        expect(fractionAtPointer(150, track)).toBe(0.25);
        expect(fractionAtPointer(300, track)).toBe(1);
    });

    it("stays on the track when the pointer leaves it", () => {
        expect(fractionAtPointer(20, track)).toBe(0);
        expect(fractionAtPointer(900, track)).toBe(1);
    });

    it("is the start of a track with no width", () => {
        expect(fractionAtPointer(150, { left: 100, width: 0 })).toBe(0);
    });
});

describe("isTap", () => {
    it("is a press that barely moved", () => {
        expect(isTap({ x: 10, y: 10 }, { x: 14, y: 7 })).toBe(true);
    });

    it("is not a drag", () => {
        expect(isTap({ x: 10, y: 10 }, { x: 40, y: 10 })).toBe(false);
        expect(isTap({ x: 10, y: 10 }, { x: 10, y: 60 })).toBe(false);
    });
});

describe("skipZone", () => {
    it("skips back on the left third and forward on the right third", () => {
        expect(skipZone(0, 300)).toBe("back");
        expect(skipZone(99, 300)).toBe("back");
        expect(skipZone(201, 300)).toBe("forward");
        expect(skipZone(300, 300)).toBe("forward");
    });

    it("does not skip in the middle third", () => {
        expect(skipZone(100, 300)).toBeNull();
        expect(skipZone(150, 300)).toBeNull();
        expect(skipZone(200, 300)).toBeNull();
    });
});

describe("seekTarget", () => {
    it("moves the position by the given seconds", () => {
        expect(seekTarget(30, 10, 120)).toBe(40);
        expect(seekTarget(30, -10, 120)).toBe(20);
    });

    it("stays within the video", () => {
        expect(seekTarget(4, -10, 120)).toBe(0);
        expect(seekTarget(115, 10, 120)).toBe(120);
    });

    it("only stops at the start while the duration is unknown", () => {
        expect(seekTarget(30, 10, NaN)).toBe(40);
        expect(seekTarget(3, -10, NaN)).toBe(0);
    });
});

describe("keyboardAction", () => {
    const key = (key: string, modifiers = {}) =>
        keyboardAction({
            key,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            ...modifiers
        });

    it("toggles play with space and K", () => {
        expect(key(" ")).toEqual({ type: "togglePlay" });
        expect(key("k")).toEqual({ type: "togglePlay" });
        expect(key("K")).toEqual({ type: "togglePlay" });
    });

    it("skips 10 s back and forward with J and L", () => {
        expect(key("j")).toEqual({ type: "seek", seconds: -10 });
        expect(key("L")).toEqual({ type: "seek", seconds: 10 });
    });

    it("seeks 5 s with the left and right arrows", () => {
        expect(key("ArrowLeft")).toEqual({ type: "seek", seconds: -5 });
        expect(key("ArrowRight")).toEqual({ type: "seek", seconds: 5 });
    });

    it("changes volume with the up and down arrows", () => {
        expect(key("ArrowUp")).toEqual({ type: "volume", change: 0.1 });
        expect(key("ArrowDown")).toEqual({ type: "volume", change: -0.1 });
    });

    it("leaves other keys and the browser's shortcuts alone", () => {
        expect(key("Escape")).toBeNull();
        expect(key("a")).toBeNull();
        expect(key("ArrowLeft", { altKey: true })).toBeNull();
        expect(key("l", { ctrlKey: true })).toBeNull();
        expect(key(" ", { metaKey: true })).toBeNull();
    });
});

describe("scrubPreviewTile", () => {
    // Seven frames two seconds apart, in rows of three
    const layout = {
        intervalSeconds: 2,
        frames: 7,
        columns: 3,
        rows: 3,
        tileWidth: 160,
        tileHeight: 90
    };

    it("finds the frame sampled at or just before the time, left to right and top to bottom", () => {
        expect(scrubPreviewTile(layout, 0)).toEqual({ left: 0, top: 0 });
        expect(scrubPreviewTile(layout, 1.99)).toEqual({ left: 0, top: 0 });
        expect(scrubPreviewTile(layout, 2)).toEqual({ left: 160, top: 0 });
        expect(scrubPreviewTile(layout, 7)).toEqual({ left: 0, top: 90 });
        expect(scrubPreviewTile(layout, 12.5)).toEqual({ left: 0, top: 180 });
    });

    it("keeps to the frames there are", () => {
        expect(scrubPreviewTile(layout, -1)).toEqual({ left: 0, top: 0 });
        expect(scrubPreviewTile(layout, 100)).toEqual({ left: 0, top: 180 });
        expect(scrubPreviewTile(layout, NaN)).toEqual({ left: 0, top: 0 });
    });
});

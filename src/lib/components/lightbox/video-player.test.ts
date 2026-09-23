import { describe, expect, it } from "vitest";
import { formatPlaybackTime, fractionAtPointer, isTap } from "./video-player";

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

import { describe, expect, it } from "vitest";
import {
    cycledScrubFrame,
    cycledScrubFrames,
    scrubFrameCover
} from "./video-tile-cycling";

/** A landscape video's preview: 160×90 frames, in rows of ten */
function layout(frames: number) {
    return {
        intervalSeconds: 1,
        frames,
        columns: Math.min(10, frames),
        rows: Math.ceil(frames / 10),
        tileWidth: 160,
        tileHeight: 90
    };
}

describe("cycledScrubFrames", () => {
    it("takes the middle frame of ten equal stretches of the video", () => {
        expect(cycledScrubFrames(layout(100))).toEqual([
            5, 15, 25, 35, 45, 55, 65, 75, 85, 95
        ]);
        expect(cycledScrubFrames(layout(25))).toEqual([
            1, 3, 6, 8, 11, 13, 16, 18, 21, 23
        ]);
    });

    it("stays within the frames there are, in order and without repeats", () => {
        for (let frames = 11; frames <= 100; frames++) {
            const picked = cycledScrubFrames(layout(frames));
            expect(picked).toHaveLength(10);
            expect(picked[0]).toBeGreaterThanOrEqual(0);
            expect(picked[9]).toBeLessThan(frames);
            picked
                .slice(1)
                .forEach((frame, i) =>
                    expect(frame).toBeGreaterThan(picked[i])
                );
        }
    });

    it("takes every frame once from a preview with ten or fewer", () => {
        expect(cycledScrubFrames(layout(10))).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
        ]);
        expect(cycledScrubFrames(layout(3))).toEqual([0, 1, 2]);
        expect(cycledScrubFrames(layout(1))).toEqual([0]);
        expect(cycledScrubFrames(layout(0))).toEqual([]);
    });
});

describe("cycledScrubFrame", () => {
    const frames = [5, 15, 25];

    it("shows the thumbnail while still", () => {
        expect(cycledScrubFrame(frames, null)).toBeNull();
    });

    it("starts from the thumbnail, then loops through the frames and back", () => {
        expect(
            [0, 1, 2, 3, 4, 5, 6, 7].map((step) =>
                cycledScrubFrame(frames, step)
            )
        ).toEqual([null, 5, 15, 25, null, 5, 15, 25]);
    });

    it("keeps to the thumbnail without frames", () => {
        expect(cycledScrubFrame([], 3)).toBeNull();
    });
});

describe("scrubFrameCover", () => {
    const preview = layout(25); // 10 columns, 3 rows of 160×90

    it("fills a square box by the frame's height and crops its sides evenly", () => {
        // 90 → 180 is a scale of 2: frames become 320×180
        const cover = scrubFrameCover(preview, 0, { width: 180, height: 180 });
        expect(cover.size).toEqual({ width: 3200, height: 540 });
        expect(cover.position).toEqual({ x: -70, y: 0 });
    });

    it("moves to the frame's column and row", () => {
        const cover = scrubFrameCover(preview, 12, { width: 180, height: 180 });
        // Column 2, row 1
        expect(cover.position).toEqual({ x: -70 - 2 * 320, y: -180 });
    });

    it("fills a wide box by the frame's width and crops top and bottom evenly", () => {
        // 160 → 320 is a scale of 2: frames become 320×180
        const cover = scrubFrameCover(preview, 1, { width: 320, height: 100 });
        expect(cover.size).toEqual({ width: 3200, height: 540 });
        expect(cover.position).toEqual({ x: -320, y: -40 });
    });

    it("keeps the frame's proportions, so a portrait frame isn't distorted", () => {
        const portrait = { ...preview, tileWidth: 90, tileHeight: 160 };
        const box = { width: 120, height: 160 };
        const cover = scrubFrameCover(portrait, 0, box);
        const frameWidth = cover.size.width / portrait.columns;
        const frameHeight = cover.size.height / portrait.rows;
        expect(frameWidth / frameHeight).toBeCloseTo(90 / 160);
        // It covers the whole box, centred
        expect(frameWidth).toBeGreaterThanOrEqual(box.width);
        expect(frameHeight).toBeGreaterThanOrEqual(box.height);
        expect(cover.position.x).toBeCloseTo((box.width - frameWidth) / 2);
        expect(cover.position.y).toBeCloseTo((box.height - frameHeight) / 2);
    });
});

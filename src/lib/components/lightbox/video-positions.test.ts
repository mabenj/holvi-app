import { describe, expect, it } from "vitest";
import {
    forgetPosition,
    isLongEnoughToResume,
    MAX_REMEMBERED_POSITIONS,
    parseVideoPositions,
    rememberPosition,
    serializeVideoPositions,
    VideoPositions
} from "./video-positions";

describe("playback positions", () => {
    it("are remembered only for videos over 60 s", () => {
        expect(isLongEnoughToResume(60.5)).toBe(true);
        expect(isLongEnoughToResume(60)).toBe(false);
        expect(isLongEnoughToResume(12)).toBe(false);
        expect(isLongEnoughToResume(NaN)).toBe(false);
        expect(isLongEnoughToResume(Infinity)).toBe(false);
    });

    it("read back what was stored, per file", () => {
        const positions = rememberPosition(
            rememberPosition(new Map(), "a", 12.5),
            "b",
            90
        );
        const stored = parseVideoPositions(serializeVideoPositions(positions));
        expect(stored.get("a")).toBe(12.5);
        expect(stored.get("b")).toBe(90);
        expect(stored.get("c")).toBeUndefined();
    });

    it("replace a file's earlier position", () => {
        const positions = rememberPosition(
            rememberPosition(new Map(), "a", 12),
            "a",
            40
        );
        expect(Array.from(positions)).toEqual([["a", 40]]);
    });

    it("are cleared per file", () => {
        const positions = forgetPosition(
            rememberPosition(rememberPosition(new Map(), "a", 12), "b", 30),
            "a"
        );
        expect(Array.from(positions)).toEqual([["b", 30]]);
    });

    it("keep only the most recently watched files", () => {
        let positions: VideoPositions = new Map();
        for (let i = 0; i < MAX_REMEMBERED_POSITIONS + 5; i++) {
            positions = rememberPosition(positions, `file-${i}`, i + 1);
        }
        // Watching an old one again makes it recent
        positions = rememberPosition(positions, "file-5", 99);
        positions = rememberPosition(positions, "new", 1);

        expect(positions.size).toBe(MAX_REMEMBERED_POSITIONS);
        expect(positions.has("file-6")).toBe(false);
        expect(positions.get("file-5")).toBe(99);
        expect(positions.get("new")).toBe(1);
    });

    it("do not change what they were given", () => {
        const positions = rememberPosition(new Map(), "a", 12);
        rememberPosition(positions, "b", 30);
        forgetPosition(positions, "a");
        expect(Array.from(positions)).toEqual([["a", 12]]);
    });

    it("ignore anything stored they cannot use", () => {
        expect(parseVideoPositions(null).size).toBe(0);
        expect(parseVideoPositions("not json").size).toBe(0);
        expect(parseVideoPositions('{"a":12}').size).toBe(0);
        expect(
            Array.from(
                parseVideoPositions(
                    '[["a",12],["b","x"],["c",-1],[3,4],"d",["e",null]]'
                )
            )
        ).toEqual([["a", 12]]);
    });
});

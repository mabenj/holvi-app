import { describe, expect, it } from "vitest";
import {
    DEFAULT_VIDEO_SETTINGS,
    parseVideoSettings,
    serializeVideoSettings
} from "./video-settings";

describe("video settings", () => {
    it("default to full volume with sound when nothing is stored", () => {
        expect(parseVideoSettings(null)).toEqual(DEFAULT_VIDEO_SETTINGS);
        expect(DEFAULT_VIDEO_SETTINGS).toEqual({ volume: 1, muted: false });
    });

    it("read back what was stored", () => {
        const stored = serializeVideoSettings({ volume: 0.4, muted: true });
        expect(parseVideoSettings(stored)).toEqual({
            volume: 0.4,
            muted: true
        });
    });

    it("read the choice the previous UI stored under the same key", () => {
        expect(parseVideoSettings('{"volume":0.25,"isMuted":true}')).toEqual({
            volume: 0.25,
            muted: true
        });
    });

    it("fall back to the defaults for anything they cannot use", () => {
        expect(parseVideoSettings("not json")).toEqual(DEFAULT_VIDEO_SETTINGS);
        expect(parseVideoSettings('"text"')).toEqual(DEFAULT_VIDEO_SETTINGS);
        expect(parseVideoSettings('{"volume":7,"isMuted":"yes"}')).toEqual(
            DEFAULT_VIDEO_SETTINGS
        );
        expect(parseVideoSettings('{"volume":0.5}')).toEqual({
            volume: 0.5,
            muted: false
        });
    });
});

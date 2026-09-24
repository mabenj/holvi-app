import { describe, expect, it } from "vitest";
import { fullscreenMode, orientationLock, rotationAction } from "./fullscreen";

describe("fullscreenMode", () => {
    it("makes the whole lightbox fullscreen where the browser can", () => {
        expect(fullscreenMode({ element: true, video: true })).toBe("element");
        expect(fullscreenMode({ element: true, video: false })).toBe(
            "element"
        );
    });

    it("falls back to the native video fullscreen, as on iPhones", () => {
        expect(fullscreenMode({ element: false, video: true })).toBe("video");
    });

    it("has none where neither is available", () => {
        expect(fullscreenMode({ element: false, video: false })).toBeNull();
    });
});

describe("orientationLock", () => {
    it("locks a button-started fullscreen to the video's orientation", () => {
        expect(orientationLock("button", { width: 1920, height: 1080 })).toBe(
            "landscape"
        );
        expect(orientationLock("button", { width: 1080, height: 1920 })).toBe(
            "portrait"
        );
    });

    it("leaves a square video, or one of unknown size, unlocked", () => {
        expect(orientationLock("button", { width: 720, height: 720 })).toBeNull();
        expect(orientationLock("button", { width: 0, height: 0 })).toBeNull();
    });

    it("never locks a fullscreen that turning the phone started", () => {
        expect(
            orientationLock("rotation", { width: 1920, height: 1080 })
        ).toBeNull();
        expect(
            orientationLock("rotation", { width: 1080, height: 1920 })
        ).toBeNull();
    });
});

describe("rotationAction", () => {
    it("starts a fullscreen on turning to landscape with a video showing", () => {
        expect(
            rotationAction({ landscape: true, onVideo: true, origin: null })
        ).toBe("enter");
    });

    it("doesn't start one on a photo, or while already fullscreen", () => {
        expect(
            rotationAction({ landscape: true, onVideo: false, origin: null })
        ).toBeNull();
        expect(
            rotationAction({ landscape: true, onVideo: true, origin: "button" })
        ).toBeNull();
        expect(
            rotationAction({
                landscape: true,
                onVideo: true,
                origin: "rotation"
            })
        ).toBeNull();
    });

    it("ends a fullscreen that turning the phone started on turning back", () => {
        expect(
            rotationAction({
                landscape: false,
                onVideo: true,
                origin: "rotation"
            })
        ).toBe("exit");
        // Also after swiping to a photo
        expect(
            rotationAction({
                landscape: false,
                onVideo: false,
                origin: "rotation"
            })
        ).toBe("exit");
    });

    it("leaves a button-started fullscreen on turning to portrait", () => {
        expect(
            rotationAction({ landscape: false, onVideo: true, origin: "button" })
        ).toBeNull();
    });

    it("does nothing on turning to portrait outside fullscreen", () => {
        expect(
            rotationAction({ landscape: false, onVideo: true, origin: null })
        ).toBeNull();
    });
});

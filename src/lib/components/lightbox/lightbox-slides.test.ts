import { FileSummary } from "@/lib/types/file-summary";
import { describe, expect, it } from "vitest";
import { isNearEnd, mapLink, toSlideData } from "./lightbox-slides";

function file(overrides: Partial<FileSummary> = {}): FileSummary {
    return {
        id: "f1",
        collectionId: "c1",
        name: "beach.jpg",
        mimeType: "image/jpeg",
        src: "/image",
        thumbnailSrc: "/thumbnail",
        width: 4000,
        height: 3000,
        thumbnailWidth: 400,
        thumbnailHeight: 300,
        timestamp: 0,
        tags: [],
        ...overrides
    };
}

describe("toSlideData", () => {
    it("zooms an image from its cropped thumbnail into the original", () => {
        expect(toSlideData(file())).toMatchObject({
            type: "image",
            fileId: "f1",
            src: "/image",
            msrc: "/thumbnail",
            width: 4000,
            height: 3000,
            thumbCropped: true
        });
    });

    it("plays a video from its playback source, showing the thumbnail until it starts", () => {
        const slide = toSlideData(
            file({
                mimeType: "video/mp4",
                playbackSrc: "/video",
                width: 1920,
                height: 1080
            })
        );
        expect(slide).toMatchObject({
            type: "video",
            videoSrc: "/video",
            msrc: "/thumbnail",
            width: 1920,
            height: 1080
        });
        expect(slide.src).toBeUndefined();
    });

    it("falls back to the thumbnail's proportions when the original's are unknown", () => {
        const slide = toSlideData(file({ width: undefined, height: undefined }));
        expect(slide).toMatchObject({ width: 400, height: 300 });
    });
});

describe("isNearEnd", () => {
    it("is near the end within a few files of the last loaded one", () => {
        expect(isNearEnd(95, 100)).toBe(true);
        expect(isNearEnd(99, 100)).toBe(true);
        expect(isNearEnd(50, 100)).toBe(false);
    });
});

describe("mapLink", () => {
    it("links to the file's coordinates on a map", () => {
        expect(mapLink({ lat: 60.17, long: 24.94 })).toBe(
            "https://www.google.com/maps/search/?api=1&query=60.17%2C24.94"
        );
    });
});

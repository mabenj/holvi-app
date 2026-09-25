import type { ScrubPreviewLayout } from "@/lib/types/scrub-preview";

/** How many of its Scrub preview's frames a cycling video tile shows */
const CYCLED_SCRUB_FRAMES = 10;

/**
 * The Scrub preview frames a cycling video tile shows, in order: the middle
 * frame of each of `CYCLED_SCRUB_FRAMES` equal stretches of the video, so
 * they spread evenly without the very first and last moments. A preview with
 * fewer frames than that shows each of them once.
 */
export function cycledScrubFrames(layout: ScrubPreviewLayout): number[] {
    const frames = Math.max(0, Math.floor(layout.frames));
    if (frames <= CYCLED_SCRUB_FRAMES) {
        return Array.from({ length: frames }, (_, i) => i);
    }
    return Array.from({ length: CYCLED_SCRUB_FRAMES }, (_, i) =>
        Math.floor(((i + 0.5) * frames) / CYCLED_SCRUB_FRAMES)
    );
}

/**
 * Which Scrub preview frame a video tile shows at a step of its cycling (the
 * `frame` of `useTileCycling`), where it loops through its thumbnail and then
 * `previewFrames`: null for the thumbnail, which it also shows while still
 */
export function cycledScrubFrame(
    previewFrames: readonly number[],
    cycleStep: number | null
): number | null {
    if (cycleStep === null || previewFrames.length === 0) return null;
    const step = cycleStep % (previewFrames.length + 1);
    return step === 0 ? null : previewFrames[step - 1];
}

/** A box's size in pixels */
export interface BoxSize {
    width: number;
    height: number;
}

/**
 * How to show one frame of a Scrub preview's image as a box's background so
 * that it fills the box, cropped and centred like `object-fit: cover`: the
 * image's `background-size` and `background-position`, in pixels, for the
 * frame at index `previewFrame`
 */
export function scrubFrameCover(
    layout: ScrubPreviewLayout,
    previewFrame: number,
    box: BoxSize
) {
    const scale = Math.max(
        box.width / layout.tileWidth,
        box.height / layout.tileHeight
    );
    const width = layout.tileWidth * scale;
    const height = layout.tileHeight * scale;
    const column = previewFrame % layout.columns;
    const row = Math.floor(previewFrame / layout.columns);
    return {
        size: { width: layout.columns * width, height: layout.rows * height },
        position: {
            x: (box.width - width) / 2 - column * width,
            y: (box.height - height) / 2 - row * height
        }
    };
}

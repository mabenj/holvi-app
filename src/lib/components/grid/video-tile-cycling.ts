import type { ScrubPreviewLayout } from "@/lib/types/scrub-preview";

/** How many of its Scrub preview's frames a cycling video tile shows */
export const CYCLED_SCRUB_FRAMES = 10;

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
 * Which Scrub preview frame a video tile shows at a frame of its cycling (see
 * `useTileCycling`), where it loops through its thumbnail and then `frames`:
 * null for the thumbnail, which it also shows while still
 */
export function cycledScrubFrame(
    frames: readonly number[],
    cycleFrame: number | null
): number | null {
    if (cycleFrame === null || frames.length === 0) return null;
    const step = cycleFrame % (frames.length + 1);
    return step === 0 ? null : frames[step - 1];
}

/** A box's size in pixels */
export interface BoxSize {
    width: number;
    height: number;
}

/**
 * How to show one frame of a Scrub preview's image as a box's background so
 * that it fills the box, cropped and centred like `object-fit: cover`: the
 * image's `background-size` and `background-position`, in pixels
 */
export function scrubFrameCover(
    layout: ScrubPreviewLayout,
    frame: number,
    box: BoxSize
) {
    const scale = Math.max(
        box.width / layout.tileWidth,
        box.height / layout.tileHeight
    );
    const width = layout.tileWidth * scale;
    const height = layout.tileHeight * scale;
    const column = frame % layout.columns;
    const row = Math.floor(frame / layout.columns);
    return {
        size: { width: layout.columns * width, height: layout.rows * height },
        position: {
            x: (box.width - width) / 2 - column * width,
            y: (box.height - height) / 2 - row * height
        }
    };
}

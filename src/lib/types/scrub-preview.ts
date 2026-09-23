/**
 * How a Scrub preview's frames are tiled into its one image: frame `n` shows
 * the video at `n * intervalSeconds`, and sits in row `n / columns` and column
 * `n % columns`, left to right and top to bottom.
 */
export interface ScrubPreviewLayout {
    /** Seconds between two frames */
    intervalSeconds: number;
    /** How many frames the image holds; the last row may be only partly filled */
    frames: number;
    columns: number;
    rows: number;
    /** One frame's size in the image, in pixels */
    tileWidth: number;
    tileHeight: number;
}

/** A video's Scrub preview, as the player loads it */
export interface ScrubPreview {
    src: string;
    layout: ScrubPreviewLayout;
}

/** Scrub previews are stored and served as JPEG */
export const SCRUB_PREVIEW_MIME_TYPE = "image/jpeg";

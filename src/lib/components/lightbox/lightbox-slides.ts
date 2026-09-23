import type { FileSummary } from "@/lib/types/file-summary";
import type { SlideData } from "photoswipe";

/** Attribute on each file's tile, which the lightbox zooms from and back into */
export const FILE_TILE_ATTRIBUTE = "data-file-id";

/** Fetch the next page once the active file is this close to the last loaded one */
const NEAR_END_DISTANCE = 5;

/** What the lightbox needs to show one file, zooming out of its thumbnail */
export interface FileSlideData extends SlideData {
    type: "image" | "video";
    fileId: string;
    /** Videos only: what the video element streams */
    videoSrc?: string;
}

export function toSlideData(file: FileSummary): FileSlideData {
    // The tiles crop the thumbnails, so the original's proportions matter for
    // the zoom; the thumbnail has the same proportions when they are unknown
    const width = file.width ?? file.thumbnailWidth;
    const height = file.height ?? file.thumbnailHeight;
    const common = {
        fileId: file.id,
        msrc: file.thumbnailSrc,
        alt: file.name,
        width,
        height,
        thumbCropped: true
    };
    return file.playbackSrc !== undefined
        ? { ...common, type: "video", videoSrc: file.playbackSrc }
        : { ...common, type: "image", src: file.src };
}

/** Whether the active file is close enough to the end of the loaded files to load more */
export function isNearEnd(index: number, loadedCount: number) {
    return index >= loadedCount - NEAR_END_DISTANCE;
}

/** Where a file was taken, on a map */
export function mapLink(gps: { lat: number; long: number }) {
    const params = new URLSearchParams({
        api: "1",
        query: `${gps.lat},${gps.long}`
    });
    return `https://www.google.com/maps/search/?${params}`;
}

/** When a file was taken, e.g. "Sat, Aug 12, 2023, 2:05 PM" in the viewer's locale */
export function formatTakenAt(timestamp: number) {
    return new Date(timestamp).toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

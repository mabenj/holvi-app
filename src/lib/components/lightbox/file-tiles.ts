import { FILE_TILE_ATTRIBUTE } from "./lightbox-slides";

/** A file's tile on the page, if it is rendered */
export function tileOf(fileId: string) {
    return document.querySelector<HTMLElement>(
        `[${FILE_TILE_ATTRIBUTE}="${CSS.escape(fileId)}"]`
    );
}

/** The thumbnail in a file's tile, which the lightbox zooms from and back into */
export function tileThumbnail(fileId: string) {
    return tileOf(fileId)?.querySelector<HTMLElement>("img") ?? null;
}

/** Scrolls a file's tile into view, clear of the bars (the tiles' scroll margins) */
export function revealTile(fileId: string) {
    tileOf(fileId)?.scrollIntoView({ block: "nearest", behavior: "instant" });
}

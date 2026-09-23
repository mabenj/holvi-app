import { useEffect, useState } from "react";

/** Thumbnail sources requested in this app session */
const requested = new Set<string>();
/** Thumbnail sources that have loaded, so the browser's caches hold them */
const loaded = new Set<string>();

/**
 * Loads a thumbnail as an ordinary image, once per app session. The browser
 * then serves it from its caches whenever a card shows it, instead of
 * requesting it again.
 */
function preload(src: string) {
    if (requested.has(src)) return;
    requested.add(src);
    const image = new window.Image();
    image.onload = () => loaded.add(src);
    // Let a later cycle try again
    image.onerror = () => requested.delete(src);
    image.src = src;
}

/**
 * The index of the thumbnail a card shows: 0 (the Cover) unless the card is
 * cycling, in which case it follows `frame` through every thumbnail. The
 * thumbnails preload when cycling starts; one that has not loaded yet is
 * skipped, and the card keeps showing the one before it.
 */
export function useCyclingThumbnail(
    thumbnails: readonly string[],
    frame: number | null
) {
    const cycling = frame !== null && thumbnails.length > 1;
    const [shown, setShown] = useState(0);

    useEffect(() => {
        if (cycling) thumbnails.slice(1).forEach(preload);
    }, [cycling, thumbnails]);

    useEffect(() => {
        if (!cycling) {
            setShown(0);
            return;
        }
        const next = frame % thumbnails.length;
        if (next === 0 || loaded.has(thumbnails[next])) setShown(next);
    }, [cycling, frame, thumbnails]);

    // Never show a frame once cycling has stopped, not even for one render
    return cycling && shown < thumbnails.length ? shown : 0;
}

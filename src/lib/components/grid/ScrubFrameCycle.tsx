import type { ScrubPreview } from "@/lib/types/scrub-preview";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    BoxSize,
    cycledScrubFrame,
    cycledScrubFrames,
    scrubFrameCover
} from "./video-tile-cycling";

/** Scrub preview images requested in this app session, by source */
const requested = new Map<string, Promise<void>>();
/** Scrub preview images that have loaded, so the browser's caches hold them */
const loaded = new Set<string>();

/**
 * Loads a Scrub preview's image as an ordinary image, once per app session.
 * Every later cycle shows it from the browser's caches.
 */
function load(src: string) {
    let request = requested.get(src);
    if (!request) {
        request = new Promise<void>((resolve, reject) => {
            const image = new window.Image();
            image.onload = () => {
                loaded.add(src);
                resolve();
            };
            image.onerror = () => {
                // Let a later cycle try again
                requested.delete(src);
                reject();
            };
            image.src = src;
        });
        requested.set(src, request);
    }
    return request;
}

interface ScrubFrameCycleProps {
    preview: ScrubPreview;
    /** The frame the tile's cycling is on (see `useTileCycling`) */
    frame: number;
}

/**
 * A cycling video tile's Scrub preview frames over its thumbnail, cropped to
 * fill the tile as the thumbnail is. Every `frame` steps from the thumbnail
 * through the frames and loops (see `cycledScrubFrame`). The image loads when
 * cycling starts, and the thumbnail shows until it has. Mounted only while
 * the tile cycles, so the tile shows its thumbnail again once it stops. Its
 * parent must be positioned.
 */
export default function ScrubFrameCycle({
    preview,
    frame
}: ScrubFrameCycleProps) {
    const { src, layout } = preview;
    const frames = useMemo(() => cycledScrubFrames(layout), [layout]);

    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    useEffect(() => {
        let live = true;
        load(src).then(
            () => live && setLoadedSrc(src),
            () => {}
        );
        return () => {
            live = false;
        };
    }, [src]);
    const ready = loadedSrc === src || loaded.has(src);

    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<BoxSize | null>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const measure = () =>
            setBox({
                width: element.clientWidth,
                height: element.clientHeight
            });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const shown = ready ? cycledScrubFrame(frames, frame) : null;
    const cover =
        shown !== null && box && box.width > 0 && box.height > 0
            ? scrubFrameCover(layout, shown, box)
            : null;
    return (
        <div
            ref={ref}
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                ...(cover && {
                    backgroundImage: `url("${src}")`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${cover.size.width}px ${cover.size.height}px`,
                    backgroundPosition: `${cover.position.x}px ${cover.position.y}px`
                })
            }}
        />
    );
}

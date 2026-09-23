import { findCentredRow } from "@/lib/components/collections/centred-row";
import { RefObject, useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

/** How long each thumbnail shows while a card cycles */
export const CYCLE_FRAME_MS = 500;
/** How long scrolling must be idle before the centred row starts cycling */
const SCROLL_IDLE_MS = 150;
/** The attribute that marks a collection card's cell in the grid, holding its id */
export const CARD_ID_ATTRIBUTE = "data-collection-id";

const NONE: ReadonlySet<string> = new Set();

/**
 * Which collection cards cycle through their thumbnails, and the frame they
 * are on. Cycling cards advance together: `frame` counts from 0 (the Cover)
 * each time the set of cycling cards changes.
 *
 * On touch, the row nearest the viewport centre cycles once scrolling has
 * been idle for a moment, and stops when scrolling resumes. Where the device
 * can hover, the hovered card cycles. Nothing cycles under reduced motion.
 *
 * `layoutKey` should change whenever the cards in the grid move, so the
 * centred row is found again.
 */
export function useThumbnailCycling(
    gridRef: RefObject<HTMLElement | null>,
    layoutKey: string
) {
    const reducedMotion = useMediaQuery(
        "(prefers-reduced-motion: reduce)",
        true
    );
    const canHover = useMediaQuery("(hover: hover)", false);
    const enabled = !reducedMotion;
    const touchMode = enabled && !canHover;
    const hoverMode = enabled && canHover;

    const [focused, setFocused] = useState<ReadonlySet<string>>(NONE);

    useEffect(() => {
        if (!touchMode) return;
        let idleTimer: number | undefined;
        const findRow = () => {
            const grid = gridRef.current;
            if (!grid) return;
            const cards = Array.from(
                grid.querySelectorAll<HTMLElement>(`[${CARD_ID_ATTRIBUTE}]`),
                (element) => {
                    const { top, bottom } = element.getBoundingClientRect();
                    return {
                        id: element.getAttribute(CARD_ID_ATTRIBUTE)!,
                        top,
                        bottom
                    };
                }
            );
            const row = findCentredRow(cards, window.innerHeight);
            setFocused((current) => (sameIds(current, row) ? current : new Set(row)));
        };
        const waitForIdle = () => {
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(findRow, SCROLL_IDLE_MS);
        };
        const onScroll = () => {
            // The row loses focus as soon as scrolling resumes
            setFocused(NONE);
            waitForIdle();
        };
        waitForIdle();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", waitForIdle);
        return () => {
            window.clearTimeout(idleTimer);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", waitForIdle);
        };
    }, [touchMode, gridRef, layoutKey]);

    const onCardHover = useCallback(
        (id: string, hovering: boolean) => {
            if (!hoverMode) return;
            setFocused((current) =>
                hovering
                    ? new Set([id])
                    : current.has(id)
                      ? NONE
                      : current
            );
        },
        [hoverMode]
    );

    // A change of mode (say, reduced motion switched on) drops what was focused
    const cycling = enabled ? focused : NONE;
    // Frames count for one set of cycling cards, so a new set starts at the Cover
    // on its very first render
    const [tick, setTick] = useState({ of: cycling, frame: 0 });
    const frame = tick.of === cycling ? tick.frame : 0;
    useEffect(() => {
        if (cycling.size === 0) return;
        const timer = window.setInterval(
            () =>
                setTick((current) => ({
                    of: cycling,
                    frame: current.of === cycling ? current.frame + 1 : 1
                })),
            CYCLE_FRAME_MS
        );
        return () => window.clearInterval(timer);
    }, [cycling]);

    return { cycling, frame, onCardHover };
}

function sameIds(current: ReadonlySet<string>, ids: string[]) {
    return current.size === ids.length && ids.every((id) => current.has(id));
}

import { useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

/** How long each frame of a cycling preview shows */
export const CYCLE_FRAME_MS = 500;

/**
 * Which one of a grid's tiles cycles its preview, and the frame it is on: the
 * held tile (see `useHoldGesture`), or else the tile under a hovering mouse.
 * `frame` counts up from 0 (the tile's own thumbnail) every time a tile
 * starts cycling, one frame per `CYCLE_FRAME_MS`; the tile loops through its
 * frames itself. Nothing cycles under reduced motion.
 *
 * Tiles are marked with their id in `idAttribute`, and need no handlers of
 * their own.
 */
export function usePreviewCycling(
    grid: HTMLElement | null,
    idAttribute: string,
    heldId: string | null
) {
    const reducedMotion = useMediaQuery(
        "(prefers-reduced-motion: reduce)",
        true
    );
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    useEffect(() => {
        if (!grid) return;
        // Only a mouse hovers: a touch or pen passing over a tile doesn't count
        const onPointerOver = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            const tile =
                event.target instanceof Element
                    ? event.target.closest(`[${idAttribute}]`)
                    : null;
            setHoveredId(tile?.getAttribute(idAttribute) ?? null);
        };
        const onPointerLeave = () => setHoveredId(null);
        grid.addEventListener("pointerover", onPointerOver);
        grid.addEventListener("pointerleave", onPointerLeave);
        return () => {
            setHoveredId(null);
            grid.removeEventListener("pointerover", onPointerOver);
            grid.removeEventListener("pointerleave", onPointerLeave);
        };
    }, [grid, idAttribute]);

    const cyclingId = reducedMotion ? null : (heldId ?? hoveredId);
    const [tick, setTick] = useState({ id: cyclingId, frame: 0 });
    // A tile that starts cycling starts from its own thumbnail on its very
    // first render, even the tile that cycled last
    if (tick.id !== cyclingId) setTick({ id: cyclingId, frame: 0 });
    useEffect(() => {
        if (cyclingId === null) return;
        const timer = window.setInterval(
            () =>
                setTick((current) =>
                    current.id === cyclingId
                        ? { id: cyclingId, frame: current.frame + 1 }
                        : current
                ),
            CYCLE_FRAME_MS
        );
        return () => window.clearInterval(timer);
    }, [cyclingId]);

    return {
        cyclingId,
        frame: tick.id === cyclingId ? tick.frame : 0
    };
}

import { tileIdAt } from "@/lib/components/grid/holdable-grid";
import { useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

/** How long each frame of a cycling tile shows */
const CYCLE_FRAME_MS = 500;

/**
 * Which one of a grid's tiles cycles, and the frame it is on: the held tile
 * (see `useHoldGesture`), or else the tile under a hovering mouse. `frame`
 * counts up from 0, the image the tile shows at rest (a collection's Cover),
 * every time a tile starts cycling, one frame per `CYCLE_FRAME_MS`; the tile
 * loops through its frames itself. Nothing cycles under reduced motion.
 * Listens on the grid, like `useHoldGesture`. Scrolling hands the hover to
 * whatever tile it brings under the mouse, so a tile scrolled away, which a
 * virtualized grid unmounts, never comes back mid-cycle.
 */
export function useTileCycling(
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
        /** Where the mouse is over the grid, or null while it isn't */
        let mouse: { x: number; y: number } | null = null;
        let pendingScroll = 0;
        // Only a mouse hovers: a touch or pen passing over a tile doesn't count
        const onPointerOver = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            mouse = { x: event.clientX, y: event.clientY };
            setHoveredId(tileIdAt(event.target, idAttribute));
        };
        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === "mouse") {
                mouse = { x: event.clientX, y: event.clientY };
            }
        };
        const onPointerLeave = () => {
            mouse = null;
            setHoveredId(null);
        };
        // Browsers only tell of the tile now under a still mouse some time
        // after scrolling, if at all
        const onScroll = () => {
            if (!mouse || pendingScroll) return;
            pendingScroll = requestAnimationFrame(() => {
                pendingScroll = 0;
                if (!mouse) return;
                const under = document.elementFromPoint(mouse.x, mouse.y);
                setHoveredId(
                    under && grid.contains(under)
                        ? tileIdAt(under, idAttribute)
                        : null
                );
            });
        };
        grid.addEventListener("pointerover", onPointerOver);
        grid.addEventListener("pointermove", onPointerMove, { passive: true });
        grid.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            setHoveredId(null);
            cancelAnimationFrame(pendingScroll);
            grid.removeEventListener("pointerover", onPointerOver);
            grid.removeEventListener("pointermove", onPointerMove);
            grid.removeEventListener("pointerleave", onPointerLeave);
            window.removeEventListener("scroll", onScroll);
        };
    }, [grid, idAttribute]);

    const cyclingId = reducedMotion ? null : (heldId ?? hoveredId);
    const [tick, setTick] = useState({ id: cyclingId, frame: 0 });
    // A tile that starts cycling starts from its resting image on its very
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

    return { cyclingId, frame: tick.frame };
}

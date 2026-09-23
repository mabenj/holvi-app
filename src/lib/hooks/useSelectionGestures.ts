import { useEffect, useRef } from "react";
import type { Selection } from "./useSelection";

/** How long a press must last to count as a long-press */
export const LONG_PRESS_MS = 500;
/** How far a press may move before it counts as a scroll or drag instead */
const MOVE_TOLERANCE_PX = 10;

/**
 * Selection gestures on a grid's tiles, each marked with its id in
 * `idAttribute`: a long-press enters selection mode (or toggles the tile while
 * in it), and while selecting a tap or click toggles the tile instead of
 * opening it. Listens on the grid, so the tiles need no handlers of their own.
 */
export function useSelectionGestures(
    grid: HTMLElement | null,
    idAttribute: string,
    /** Absent where nothing can be selected */
    selection: Selection | undefined
) {
    const latest = useRef(selection);
    latest.current = selection;
    const enabled = !!selection;

    useEffect(() => {
        if (!grid || !enabled) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        let origin: { x: number; y: number } | null = null;
        /** A long-press just fired, so the click that may follow it is not a tap */
        let pressed = false;
        let pointerType = "mouse";

        const tileId = (target: EventTarget | null) =>
            target instanceof Element
                ? target.closest(`[${idAttribute}]`)?.getAttribute(idAttribute)
                : null;

        const cancel = () => {
            clearTimeout(timer);
            timer = undefined;
            origin = null;
        };

        const onPointerDown = (event: PointerEvent) => {
            pressed = false;
            pointerType = event.pointerType;
            if (!event.isPrimary || event.button !== 0) return;
            const id = tileId(event.target);
            if (!id) return;
            origin = { x: event.clientX, y: event.clientY };
            timer = setTimeout(() => {
                cancel();
                pressed = true;
                const current = latest.current;
                if (current?.selecting) current.toggle(id);
                else current?.start(id);
                navigator.vibrate?.(10);
            }, LONG_PRESS_MS);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!origin) return;
            const moved = Math.hypot(
                event.clientX - origin.x,
                event.clientY - origin.y
            );
            if (moved > MOVE_TOLERANCE_PX) cancel();
        };

        // Captured, so neither a tile's link nor its own click handler sees it
        const onClick = (event: MouseEvent) => {
            const id = tileId(event.target);
            if (pressed) {
                pressed = false;
                event.preventDefault();
                event.stopPropagation();
            } else if (id && latest.current?.selecting) {
                event.preventDefault();
                event.stopPropagation();
                latest.current.toggle(id);
            }
        };

        // A touch long-press would otherwise open the browser's menu for the
        // tile's link or image
        const onContextMenu = (event: MouseEvent) => {
            if (pointerType !== "mouse" && tileId(event.target)) {
                event.preventDefault();
            }
        };

        grid.addEventListener("pointerdown", onPointerDown);
        grid.addEventListener("pointermove", onPointerMove);
        grid.addEventListener("pointerup", cancel);
        grid.addEventListener("pointercancel", cancel);
        grid.addEventListener("pointerleave", cancel);
        grid.addEventListener("click", onClick, true);
        grid.addEventListener("contextmenu", onContextMenu);
        window.addEventListener("scroll", cancel, { passive: true });
        return () => {
            cancel();
            grid.removeEventListener("pointerdown", onPointerDown);
            grid.removeEventListener("pointermove", onPointerMove);
            grid.removeEventListener("pointerup", cancel);
            grid.removeEventListener("pointercancel", cancel);
            grid.removeEventListener("pointerleave", cancel);
            grid.removeEventListener("click", onClick, true);
            grid.removeEventListener("contextmenu", onContextMenu);
            window.removeEventListener("scroll", cancel);
        };
    }, [grid, idAttribute, enabled]);
}

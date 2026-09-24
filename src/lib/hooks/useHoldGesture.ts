import { tileIdAt } from "@/lib/components/grid/holdable-grid";
import {
    blocksScroll,
    HOLD_MS,
    HoldEvent,
    HoldState,
    IDLE,
    nextHoldState
} from "@/lib/components/grid/hold-gesture";
import { useEffect, useRef, useState } from "react";
import type { Selection } from "./useSelection";

/** How long after a hold is lifted the click that follows it may arrive */
const CLICK_DELAY_MS = 400;

/**
 * The hold gesture on a grid's tiles, each marked with its id in
 * `idAttribute`, for any pointer. Holding a tile for `HOLD_MS` vibrates where
 * the device can, keeps the page from scrolling and makes the tile the held
 * one, which the grid cycles (see `useTileCycling`). Lifting the hold in
 * place selects the tile, or toggles it while selecting; moving away cancels
 * both (see `nextHoldState`). A tap opens the tile as before, or toggles it
 * while selecting. Listens on the grid, so the tiles need no handlers of
 * their own; the grid should have `HOLDABLE_GRID`'s styles.
 *
 * Returns the id of the tile being held, or null.
 */
export function useHoldGesture(
    grid: HTMLElement | null,
    idAttribute: string,
    /** Absent where nothing can be selected: a hold then only cycles the tile */
    selection: Selection | undefined
): string | null {
    const latest = useRef(selection);
    latest.current = selection;
    const [held, setHeld] = useState<string | null>(null);

    useEffect(() => {
        if (!grid) return;

        let state: HoldState = IDLE;
        let timer: ReturnType<typeof setTimeout> | undefined;
        /**
         * Until when a click is taken to follow a hold that just ended, and so
         * is no tap. A touch hold may end without one, and a later click from
         * the keyboard must still count.
         */
        let swallowClickUntil = 0;
        let pointerType = "mouse";

        const tileId = (target: EventTarget | null) =>
            tileIdAt(target, idAttribute);

        const dispatch = (event: HoldEvent) => {
            const transition = nextHoldState(state, event);
            state = transition.state;
            for (const effect of transition.effects) {
                switch (effect.type) {
                    case "wait":
                        clearTimeout(timer);
                        timer = setTimeout(
                            () => dispatch({ type: "elapsed" }),
                            HOLD_MS
                        );
                        break;
                    case "stopWaiting":
                        clearTimeout(timer);
                        break;
                    case "holdStarted":
                        navigator.vibrate?.(10);
                        setHeld(effect.id);
                        break;
                    case "holdEnded":
                        setHeld(null);
                        break;
                    case "select": {
                        const current = latest.current;
                        if (current?.selecting) current.toggle(effect.id);
                        else current?.start(effect.id);
                        break;
                    }
                    case "swallowClick":
                        swallowClickUntil = performance.now() + CLICK_DELAY_MS;
                        break;
                }
            }
        };

        const onPointerDown = (event: PointerEvent) => {
            swallowClickUntil = 0;
            pointerType = event.pointerType;
            if (!event.isPrimary || event.button !== 0) return;
            const id = tileId(event.target);
            if (!id) return;
            dispatch({
                type: "down",
                id,
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY
            });
        };
        const onPointerMove = (event: PointerEvent) =>
            dispatch({
                type: "move",
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY
            });
        const onPointerUp = (event: PointerEvent) =>
            dispatch({ type: "up", pointerId: event.pointerId });
        const onPointerCancel = (event: PointerEvent) =>
            dispatch({ type: "lost", pointerId: event.pointerId });
        const onScroll = () => dispatch({ type: "interrupt" });

        // Not passive, so it can keep the page still while a tile is held;
        // touch events stay with the element they started on, so every move
        // of a touch that started on a tile comes here
        const onTouchMove = (event: TouchEvent) => {
            if (blocksScroll(state) && event.cancelable) event.preventDefault();
        };

        // Captured, so neither a tile's link nor its own click handler sees it
        const onClick = (event: MouseEvent) => {
            const id = tileId(event.target);
            if (performance.now() < swallowClickUntil) {
                swallowClickUntil = 0;
                event.preventDefault();
                event.stopPropagation();
            } else if (id && latest.current?.selecting) {
                event.preventDefault();
                event.stopPropagation();
                latest.current.toggle(id);
            }
        };

        // A touch hold would otherwise open the browser's menu for the tile's
        // link or image
        const onContextMenu = (event: MouseEvent) => {
            if (pointerType !== "mouse" && tileId(event.target)) {
                event.preventDefault();
            }
        };

        // Dragging the held tile's link or image away would take the pointer
        // over before it moved far enough to cancel the hold
        const onDragStart = (event: DragEvent) => {
            if (blocksScroll(state)) event.preventDefault();
        };

        grid.addEventListener("pointerdown", onPointerDown);
        grid.addEventListener("touchmove", onTouchMove, { passive: false });
        grid.addEventListener("click", onClick, true);
        grid.addEventListener("contextmenu", onContextMenu);
        grid.addEventListener("dragstart", onDragStart);
        // A mouse can leave the grid while pressing, and lift outside it
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            clearTimeout(timer);
            setHeld(null);
            grid.removeEventListener("pointerdown", onPointerDown);
            grid.removeEventListener("touchmove", onTouchMove);
            grid.removeEventListener("click", onClick, true);
            grid.removeEventListener("contextmenu", onContextMenu);
            grid.removeEventListener("dragstart", onDragStart);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            window.removeEventListener("scroll", onScroll);
        };
    }, [grid, idAttribute]);

    return held;
}

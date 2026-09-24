/** How long a press must last to become a hold */
export const HOLD_MS = 500;
/** How far a press or hold may move from where it started before it is cancelled */
export const MOVE_TOLERANCE_PX = 10;

/**
 * Where one pointer's press on a grid's tile stands:
 * - `pressing`: down on the tile, not yet held long enough to be a hold;
 * - `holding`: held for `HOLD_MS` without moving away, so the tile previews;
 * - `cancelled`: was a hold, then moved away (or the page scrolled), and the
 *   pointer is still down. Lifting it selects nothing.
 */
export type HoldState =
    | { phase: "idle" }
    | {
          phase: "pressing" | "holding";
          id: string;
          pointerId: number;
          x: number;
          y: number;
      }
    | { phase: "cancelled"; pointerId: number };

export type HoldEvent =
    /** The primary pointer went down on the tile with this id */
    | { type: "down"; id: string; pointerId: number; x: number; y: number }
    | { type: "move"; pointerId: number; x: number; y: number }
    /** `HOLD_MS` passed since the last `wait` effect */
    | { type: "elapsed" }
    | { type: "up"; pointerId: number }
    /** The pointer is gone without being lifted, e.g. the browser took it over */
    | { type: "lost"; pointerId: number }
    /** The tile moved under the pointer, e.g. the page scrolled */
    | { type: "interrupt" };

export type HoldEffect =
    /** Start the timer that sends `elapsed` after `HOLD_MS`, replacing any running one */
    | { type: "wait" }
    /** Stop that timer */
    | { type: "stopWaiting" }
    /** The tile is now held: vibrate, start its preview and keep the page from scrolling */
    | { type: "holdStarted"; id: string }
    /** The tile is no longer held: its preview stops */
    | { type: "holdEnded"; id: string }
    /** The hold was lifted in place: select the tile, or toggle it while selecting */
    | { type: "select"; id: string }
    /** Ignore the click that may follow, since it ended a hold and was no tap */
    | { type: "swallowClick" };

export interface HoldTransition {
    state: HoldState;
    effects: HoldEffect[];
}

export const IDLE: HoldState = { phase: "idle" };

/**
 * The hold gesture on a grid's tiles, one pointer at a time. A press that is
 * lifted before `HOLD_MS` is a tap, which the gesture leaves alone. A press
 * held for `HOLD_MS` becomes a hold, and lifting it in place selects the tile.
 * Moving more than `MOVE_TOLERANCE_PX` from where it went down cancels the
 * press, or the hold together with its selection.
 */
export function nextHoldState(
    state: HoldState,
    event: HoldEvent
): HoldTransition {
    switch (event.type) {
        case "down": {
            const { id, pointerId, x, y } = event;
            return {
                state: { phase: "pressing", id, pointerId, x, y },
                // A press whose lift never arrived gives way to the new one
                effects: [...endHold(state), { type: "wait" }]
            };
        }
        case "elapsed":
            if (state.phase !== "pressing") return unchanged(state);
            return {
                state: { ...state, phase: "holding" },
                effects: [{ type: "holdStarted", id: state.id }]
            };
        case "move": {
            if (state.phase === "idle" || state.phase === "cancelled") {
                return unchanged(state);
            }
            if (event.pointerId !== state.pointerId) return unchanged(state);
            const moved = Math.hypot(event.x - state.x, event.y - state.y);
            if (moved <= MOVE_TOLERANCE_PX) return unchanged(state);
            return cancel(state);
        }
        case "interrupt":
            return state.phase === "idle" || state.phase === "cancelled"
                ? unchanged(state)
                : cancel(state);
        case "up":
        case "lost": {
            if (state.phase === "idle") return unchanged(state);
            if (event.pointerId !== state.pointerId) return unchanged(state);
            if (state.phase === "pressing") {
                return { state: IDLE, effects: [{ type: "stopWaiting" }] };
            }
            const lifted = event.type === "up";
            return {
                state: IDLE,
                effects: [
                    ...endHold(state),
                    ...(lifted && state.phase === "holding"
                        ? [{ type: "select", id: state.id } as const]
                        : []),
                    { type: "swallowClick" }
                ]
            };
        }
    }
}

/** Whether the page must not scroll: a hold is on, or was until it moved away */
export function blocksScroll(state: HoldState) {
    return state.phase === "holding" || state.phase === "cancelled";
}

/** The id of the tile being held, if any */
export function heldId(state: HoldState) {
    return state.phase === "holding" ? state.id : null;
}

function unchanged(state: HoldState): HoldTransition {
    return { state, effects: [] };
}

/** A press is simply dropped; a hold stays cancelled until its pointer lifts */
function cancel(
    state: Extract<HoldState, { phase: "pressing" | "holding" }>
): HoldTransition {
    if (state.phase === "pressing") {
        return { state: IDLE, effects: [{ type: "stopWaiting" }] };
    }
    return {
        state: { phase: "cancelled", pointerId: state.pointerId },
        effects: endHold(state)
    };
}

function endHold(state: HoldState): HoldEffect[] {
    switch (state.phase) {
        case "pressing":
            return [{ type: "stopWaiting" }];
        case "holding":
            return [{ type: "holdEnded", id: state.id }];
        default:
            return [];
    }
}

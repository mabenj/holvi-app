import { describe, expect, it } from "vitest";
import {
    blocksScroll,
    HoldEffect,
    HoldEvent,
    HoldState,
    heldId,
    IDLE,
    nextHoldState
} from "./hold-gesture";

/** Runs the events from idle, collecting every effect on the way */
function run(...events: HoldEvent[]) {
    let state: HoldState = IDLE;
    const effects: HoldEffect[] = [];
    for (const event of events) {
        const transition = nextHoldState(state, event);
        state = transition.state;
        effects.push(...transition.effects);
    }
    return { state, effects };
}

const down = (id = "a", x = 100, y = 100): HoldEvent => ({
    type: "down",
    id,
    pointerId: 1,
    x,
    y
});
const move = (x: number, y: number, pointerId = 1): HoldEvent => ({
    type: "move",
    pointerId,
    x,
    y
});
const elapsed: HoldEvent = { type: "elapsed" };
const up = (pointerId = 1): HoldEvent => ({ type: "up", pointerId });
const lost: HoldEvent = { type: "lost", pointerId: 1 };
const interrupt: HoldEvent = { type: "interrupt" };

describe("nextHoldState", () => {
    it("leaves a tap alone", () => {
        const { state, effects } = run(down(), up());
        expect(state).toEqual(IDLE);
        expect(effects).toEqual([{ type: "wait" }, { type: "stopWaiting" }]);
    });

    it("starts a hold once the press has lasted long enough", () => {
        const { state, effects } = run(down("a"), elapsed);
        expect(heldId(state)).toBe("a");
        expect(blocksScroll(state)).toBe(true);
        expect(effects).toEqual([
            { type: "wait" },
            { type: "holdStarted", id: "a" }
        ]);
    });

    it("selects the tile when a hold is lifted in place, and swallows its click", () => {
        const { state, effects } = run(down("a"), elapsed, up());
        expect(state).toEqual(IDLE);
        expect(effects.slice(2)).toEqual([
            { type: "holdEnded", id: "a" },
            { type: "select", id: "a" },
            { type: "swallowClick" }
        ]);
    });

    it("tolerates a little movement during the press and the hold", () => {
        const { effects } = run(
            down("a", 100, 100),
            move(106, 106),
            elapsed,
            move(93, 107),
            up()
        );
        expect(effects).toContainEqual({ type: "select", id: "a" });
    });

    it("drops a press that moves too far before it becomes a hold", () => {
        const { state, effects } = run(down("a", 100, 100), move(100, 111));
        expect(state).toEqual(IDLE);
        expect(effects).toEqual([{ type: "wait" }, { type: "stopWaiting" }]);
        // A late timer does nothing
        expect(nextHoldState(state, elapsed).effects).toEqual([]);
    });

    it("cancels a hold that moves too far, selecting nothing when lifted", () => {
        const moved = run(down("a", 100, 100), elapsed, move(111, 100));
        expect(heldId(moved.state)).toBeNull();
        // The page still doesn't scroll until the pointer lifts
        expect(blocksScroll(moved.state)).toBe(true);
        expect(moved.effects.at(-1)).toEqual({ type: "holdEnded", id: "a" });

        const lifted = run(
            down("a", 100, 100),
            elapsed,
            move(111, 100),
            move(100, 100),
            up()
        );
        expect(lifted.state).toEqual(IDLE);
        expect(lifted.effects).not.toContainEqual(
            expect.objectContaining({ type: "select" })
        );
        expect(lifted.effects.at(-1)).toEqual({ type: "swallowClick" });
    });

    it("measures movement from where the press went down", () => {
        const { effects } = run(
            down("a", 100, 100),
            move(108, 100),
            elapsed,
            move(111, 100)
        );
        expect(effects.at(-1)).toEqual({ type: "holdEnded", id: "a" });
    });

    it("cancels a hold when the page scrolls under it", () => {
        const { effects } = run(down("a"), elapsed, interrupt, up());
        expect(effects.slice(2)).toEqual([
            { type: "holdEnded", id: "a" },
            { type: "swallowClick" }
        ]);
    });

    it("drops a press when the page scrolls under it", () => {
        const { state, effects } = run(down("a"), interrupt);
        expect(state).toEqual(IDLE);
        expect(effects.at(-1)).toEqual({ type: "stopWaiting" });
    });

    it("selects nothing when the browser takes the pointer over during a hold", () => {
        const { state, effects } = run(down("a"), elapsed, lost);
        expect(state).toEqual(IDLE);
        // No click follows a pointer that never lifted
        expect(effects.slice(2)).toEqual([{ type: "holdEnded", id: "a" }]);
    });

    it("ignores other pointers", () => {
        const { state, effects } = run(
            down("a", 100, 100),
            elapsed,
            move(300, 300, 2),
            up(2)
        );
        expect(heldId(state)).toBe("a");
        expect(effects).toHaveLength(2);
    });

    it("gives way to a new press when the last one's lift never arrived", () => {
        const { state, effects } = run(down("a"), elapsed, down("b"));
        expect(state).toMatchObject({ phase: "pressing", id: "b" });
        expect(effects.slice(2)).toEqual([
            { type: "holdEnded", id: "a" },
            { type: "wait" }
        ]);
    });

    it("does nothing for a pointer that isn't pressing", () => {
        for (const event of [move(500, 500), up(), lost, interrupt, elapsed]) {
            expect(nextHoldState(IDLE, event)).toEqual({
                state: IDLE,
                effects: []
            });
        }
    });
});

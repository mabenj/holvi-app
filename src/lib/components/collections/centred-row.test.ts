import { describe, expect, it } from "vitest";
import { CardBox, findCentredRow } from "./centred-row";

/** Cards laid out in rows of `columns`, each row `height` tall, scrolled by `scrollY` */
function grid(count: number, columns: number, height: number, scrollY = 0) {
    return Array.from(
        { length: count },
        (_, i): CardBox => ({
            id: `c${i}`,
            top: Math.floor(i / columns) * height - scrollY,
            bottom: Math.floor(i / columns) * height - scrollY + height
        })
    );
}

describe("findCentredRow", () => {
    it("returns every card in the row whose centre is nearest the viewport centre", () => {
        // Rows centred at 50, 150, 250, 350; viewport centre at 200 + 40
        const cards = grid(12, 3, 100);
        expect(findCentredRow(cards, 480)).toEqual(["c6", "c7", "c8"]);
    });

    it("follows the scroll position", () => {
        const cards = grid(30, 3, 100, 520);
        // Row 7 spans 180..280 on screen, the nearest to a centre of 200
        expect(findCentredRow(cards, 400)).toEqual(["c21", "c22", "c23"]);
    });

    it("includes a last row that is not full", () => {
        const cards = grid(8, 3, 100);
        expect(findCentredRow(cards, 500)).toEqual(["c6", "c7"]);
    });

    it("ignores cards outside the viewport", () => {
        // The grid ends well above the centre, and a card below is off screen
        const cards = [
            ...grid(3, 3, 100),
            { id: "below", top: 900, bottom: 1000 }
        ];
        expect(findCentredRow(cards, 800)).toEqual(["c0", "c1", "c2"]);
    });

    it("returns nothing when no card is on screen", () => {
        expect(findCentredRow([], 800)).toEqual([]);
        expect(findCentredRow(grid(3, 3, 100, 500), 800)).toEqual([]);
    });
});

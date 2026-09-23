/** Where one collection card sits, relative to the top of the viewport */
export interface CardBox {
    id: string;
    top: number;
    bottom: number;
}

/**
 * The ids of the cards in the row whose centre is nearest the viewport's
 * centre, considering only cards that are at least partly on screen.
 */
export function findCentredRow(
    cards: readonly CardBox[],
    viewportHeight: number
): string[] {
    const centre = viewportHeight / 2;
    const onScreen = cards.filter(
        (card) => card.bottom > 0 && card.top < viewportHeight
    );
    let nearest: CardBox | undefined;
    let nearestDistance = Infinity;
    for (const card of onScreen) {
        const distance = Math.abs((card.top + card.bottom) / 2 - centre);
        if (distance < nearestDistance) {
            nearest = card;
            nearestDistance = distance;
        }
    }
    if (!nearest) return [];
    const rowTop = nearest.top;
    // Cards in one grid row share a top edge, give or take subpixel rounding
    return onScreen
        .filter((card) => Math.abs(card.top - rowTop) < 1)
        .map((card) => card.id);
}

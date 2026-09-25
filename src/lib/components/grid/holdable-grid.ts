/**
 * Styles for a grid whose tiles can be held (see `useHoldGesture`): no text
 * selection, and no iOS callout for the tiles' links and images, which a
 * hold would otherwise bring up
 */
export const HOLDABLE_GRID = {
    userSelect: "none",
    WebkitUserSelect: "none",
    "& a, & img": { WebkitTouchCallout: "none" }
} as const;

/**
 * The id of the grid tile an event happened in, where tiles are marked with
 * their id in `idAttribute`, so a grid can listen for its tiles' events itself
 */
export function tileIdAt(target: EventTarget | null, idAttribute: string) {
    return target instanceof Element
        ? (target.closest(`[${idAttribute}]`)?.getAttribute(idAttribute) ??
              null)
        : null;
}

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

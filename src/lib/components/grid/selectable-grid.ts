/**
 * Styles for a grid whose tiles can be long-pressed: no text selection, and
 * no iOS callout for the tiles' links and images, which a long-press would
 * otherwise bring up
 */
export const SELECTABLE_GRID = {
    userSelect: "none",
    WebkitUserSelect: "none",
    "& a, & img": { WebkitTouchCallout: "none" }
} as const;

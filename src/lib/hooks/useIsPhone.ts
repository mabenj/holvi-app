import { useSyncExternalStore } from "react";

// Below Chakra's `md` breakpoint (48rem)
const PHONE_QUERY = "(max-width: 47.99rem)";

function subscribe(onChange: () => void) {
    const query = window.matchMedia(PHONE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the viewport is phone-sized. Always false during server rendering,
 * so use it only for things that appear after an interaction, such as sheets.
 */
export function useIsPhone() {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(PHONE_QUERY).matches,
        () => false
    );
}

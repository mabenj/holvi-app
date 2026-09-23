import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept up to date as it changes.
 * `serverValue` is used during server rendering and hydration.
 */
export function useMediaQuery(query: string, serverValue: boolean) {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        [query]
    );
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => serverValue
    );
}

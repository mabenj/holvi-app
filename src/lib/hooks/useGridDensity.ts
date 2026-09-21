import { useCallback, useSyncExternalStore } from "react";

/** Number of grid columns on a phone; larger screens scale it proportionally */
export type GridDensity = 2 | 3 | 5;

export const GRID_DENSITIES: readonly GridDensity[] = [2, 3, 5];
export const DEFAULT_GRID_DENSITY: GridDensity = 3;

const STORAGE_KEY = "holvi.gridDensity";
// The storage event only reaches other tabs, so this tab is told with its own event
const CHANGE_EVENT = "holvi:grid-density";

function read(): GridDensity {
    try {
        const stored = Number(window.localStorage.getItem(STORAGE_KEY));
        return GRID_DENSITIES.find((density) => density === stored) ??
            DEFAULT_GRID_DENSITY;
    } catch {
        // Storage can be unavailable, e.g. in some private windows
        return DEFAULT_GRID_DENSITY;
    }
}

function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
    };
}

/**
 * The viewer's grid density, kept per browser. Server rendering and the first
 * client render use the default.
 */
export function useGridDensity() {
    const density = useSyncExternalStore(
        subscribe,
        read,
        () => DEFAULT_GRID_DENSITY
    );

    const setDensity = useCallback((next: GridDensity) => {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
            // Without storage the choice cannot persist
        }
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    return [density, setDensity] as const;
}

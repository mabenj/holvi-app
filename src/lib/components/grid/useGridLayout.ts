import { GridDensity, useGridDensity } from "@/lib/hooks/useGridDensity";
import { useBreakpointValue } from "@chakra-ui/react";
import { useEffect, useState } from "react";

/** Columns per breakpoint (base, sm, md, lg, xl, 2xl) at the default density of 3 */
const COLUMNS = [3, 3, 4, 6, 8, 9];
/** Tile heights per breakpoint (base, sm, md, lg and up) at the default density */
const TILE_HEIGHTS_REM = [8, 10, 11, 11];

export interface GridLayout {
    columns: number[];
    tileHeights: string[];
}

/** The columns and tile heights of the grid, scaled by the grid density */
function gridLayout(density: GridDensity): GridLayout {
    const scale = density / 3;
    return {
        columns: COLUMNS.map((count) => Math.max(1, Math.round(count * scale))),
        tileHeights: TILE_HEIGHTS_REM.map(
            (rem) => `${Math.round((rem / scale) * 10) / 10}rem`
        )
    };
}

/**
 * The layout shared by the Collections grid and a collection page's files grid.
 * Null until mounted: the stored density is only known after hydration, and
 * laying out before that would make the grid jump.
 */
export function useGridLayout(): GridLayout | null {
    const [density] = useGridDensity();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted ? gridLayout(density) : null;
}

/** The grid's column count and tile height at the current screen width, in pixels */
export interface ResolvedGridLayout {
    columns: number;
    tileHeightPx: number;
}

/** Breakpoint names in the order of the layout's per-breakpoint values */
const BREAKPOINTS = ["base", "sm", "md", "lg", "xl", "2xl"] as const;

/** Per-breakpoint values as Chakra's responsive object; the last value holds from there up */
function byBreakpoint<T>(values: T[]) {
    return Object.fromEntries(
        BREAKPOINTS.map((name, i) => [
            name,
            values[Math.min(i, values.length - 1)]
        ])
    ) as Record<(typeof BREAKPOINTS)[number], T>;
}

/**
 * The grid layout resolved for the current screen width, for grids that
 * position tiles themselves, like the virtualized Timeline. It matches the
 * responsive layout of `useGridLayout`. Null until mounted.
 */
export function useResolvedGridLayout(): ResolvedGridLayout | null {
    const layout = useGridLayout();
    const columns = useBreakpointValue(byBreakpoint(layout?.columns ?? [0]));
    const tileHeight = useBreakpointValue(
        byBreakpoint(layout?.tileHeights ?? ["0rem"])
    );
    if (!layout || !columns || !tileHeight) {
        return null;
    }
    const remPx = parseFloat(
        getComputedStyle(document.documentElement).fontSize
    );
    return { columns, tileHeightPx: parseFloat(tileHeight) * remPx };
}

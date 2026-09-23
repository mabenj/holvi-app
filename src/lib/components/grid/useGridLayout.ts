import { GridDensity, useGridDensity } from "@/lib/hooks/useGridDensity";
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

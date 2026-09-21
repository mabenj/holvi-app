import { GridDensity, useGridDensity } from "@/lib/hooks/useGridDensity";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import CollectionCard from "./CollectionCard";

/** Columns per breakpoint (base, sm, md, lg, xl, 2xl) at the default density of 3 */
const COLUMNS = [3, 3, 4, 6, 8, 9];
/** Tile heights per breakpoint (base, sm, md, lg and up) at the default density */
const TILE_HEIGHTS_REM = [8, 10, 11, 11];
// Chakra v3's breakpoints, for the `sizes` media conditions
const BREAKPOINT_MIN_WIDTHS = ["", "30em", "48em", "64em", "80em", "96em"];

/** The columns and tile heights of today's grid, scaled by the grid density */
function gridLayout(density: GridDensity) {
    const scale = density / 3;
    const columns = COLUMNS.map((count) => Math.max(1, Math.round(count * scale)));
    return {
        columns,
        tileHeights: TILE_HEIGHTS_REM.map(
            (rem) => `${Math.round((rem / scale) * 10) / 10}rem`
        ),
        sizes: columns
            .map((count, i) =>
                i === 0
                    ? `${Math.ceil(100 / count)}vw`
                    : `(min-width: ${BREAKPOINT_MIN_WIDTHS[i]}) ${Math.ceil(100 / count)}vw`
            )
            .reverse()
            .join(", ")
    };
}

interface CollectionGridProps {
    collections: CollectionSummary[];
    /** Skeleton tiles after the collections, where nothing is known yet */
    skeletons?: number;
}

/** The tight collections grid: hairline gaps and cover-cropped tiles */
export default function CollectionGrid({
    collections,
    skeletons = 0
}: CollectionGridProps) {
    const [density] = useGridDensity();
    // The stored density is only known after hydration; laying out before
    // that would make the grid jump
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) {
        return null;
    }

    const { columns, tileHeights, sizes } = gridLayout(density);
    return (
        <SimpleGrid columns={columns} gap="2px">
            {collections.map((collection) => (
                <Box key={collection.id} h={tileHeights}>
                    <CollectionCard collection={collection} sizes={sizes} />
                </Box>
            ))}
            {Array.from({ length: skeletons }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} h={tileHeights} rounded="none" />
            ))}
        </SimpleGrid>
    );
}

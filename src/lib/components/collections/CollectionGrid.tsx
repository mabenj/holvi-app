import {
    CARD_ID_ATTRIBUTE,
    useThumbnailCycling
} from "@/lib/hooks/useThumbnailCycling";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { useLayoutEffect, useRef } from "react";
import { useGridLayout } from "../grid/useGridLayout";
import CollectionCard from "./CollectionCard";

interface CollectionGridProps {
    collections: CollectionSummary[];
    /** Skeleton tiles after the collections, where nothing is known yet */
    skeletons?: number;
    /** Called once the tiles are in the page and before it paints, e.g. to restore the scroll position */
    onLaidOut?: () => void;
}

/** The tight collections grid: hairline gaps and cover-cropped tiles */
export default function CollectionGrid({
    collections,
    skeletons = 0,
    onLaidOut
}: CollectionGridProps) {
    const layout = useGridLayout();
    const laidOut = layout !== null;
    useLayoutEffect(() => {
        if (laidOut) onLaidOut?.();
    }, [laidOut, onLaidOut]);
    const gridRef = useRef<HTMLDivElement>(null);
    const { cycling, frame, onCardHover } = useThumbnailCycling(
        gridRef,
        // The columns follow the grid density
        `${laidOut}:${layout?.columns.join(",")}:${collections.length}:${collections[0]?.id}`
    );
    if (!layout) {
        return null;
    }

    const { columns, tileHeights } = layout;
    return (
        <SimpleGrid ref={gridRef} columns={columns} gap="2px">
            {collections.map((collection) => (
                <Box
                    key={collection.id}
                    h={tileHeights}
                    {...{ [CARD_ID_ATTRIBUTE]: collection.id }}>
                    <CollectionCard
                        collection={collection}
                        frame={cycling.has(collection.id) ? frame : null}
                        onHoverChange={onCardHover}
                    />
                </Box>
            ))}
            {Array.from({ length: skeletons }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} h={tileHeights} rounded="none" />
            ))}
        </SimpleGrid>
    );
}

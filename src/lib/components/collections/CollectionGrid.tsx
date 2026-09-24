import { useHoldGesture } from "@/lib/hooks/useHoldGesture";
import { usePreviewCycling } from "@/lib/hooks/usePreviewCycling";
import type { Selection } from "@/lib/hooks/useSelection";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { useLayoutEffect, useState } from "react";
import { HOLDABLE_GRID } from "../grid/holdable-grid";
import { useGridLayout } from "../grid/useGridLayout";
import SelectionMark from "../selection/SelectionMark";
import CollectionCard from "./CollectionCard";

/** The attribute that marks a collection card's cell in the grid, holding its id */
const CARD_ID_ATTRIBUTE = "data-collection-id";

interface CollectionGridProps {
    collections: CollectionSummary[];
    /** Skeleton tiles after the collections, where nothing is known yet */
    skeletons?: number;
    /** Called once the tiles are in the page and before it paints, e.g. to restore the scroll position */
    onLaidOut?: () => void;
    /** Where collections can be selected: lifting a hold in place starts selecting */
    selection?: Selection;
}

/**
 * The tight collections grid: hairline gaps and cover-cropped tiles. The card
 * being held, or else the one under a hovering mouse, cycles its thumbnails.
 */
export default function CollectionGrid({
    collections,
    skeletons = 0,
    onLaidOut,
    selection
}: CollectionGridProps) {
    const layout = useGridLayout();
    const laidOut = layout !== null;
    useLayoutEffect(() => {
        if (laidOut) onLaidOut?.();
    }, [laidOut, onLaidOut]);
    const [grid, setGrid] = useState<HTMLDivElement | null>(null);
    const heldId = useHoldGesture(grid, CARD_ID_ATTRIBUTE, selection);
    const { cyclingId, frame } = usePreviewCycling(
        grid,
        CARD_ID_ATTRIBUTE,
        heldId
    );
    if (!layout) {
        return null;
    }

    const { columns, tileHeights } = layout;
    return (
        <SimpleGrid
            ref={setGrid}
            columns={columns}
            gap="2px"
            css={HOLDABLE_GRID}>
            {collections.map((collection) => (
                <Box
                    key={collection.id}
                    position="relative"
                    h={tileHeights}
                    {...{ [CARD_ID_ATTRIBUTE]: collection.id }}>
                    <CollectionCard
                        collection={collection}
                        frame={collection.id === cyclingId ? frame : null}
                    />
                    {selection?.selecting && (
                        <SelectionMark
                            selected={selection.isSelected(collection.id)}
                        />
                    )}
                </Box>
            ))}
            {Array.from({ length: skeletons }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} h={tileHeights} rounded="none" />
            ))}
        </SimpleGrid>
    );
}

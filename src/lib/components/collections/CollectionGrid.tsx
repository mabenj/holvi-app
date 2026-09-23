import {
    CARD_ID_ATTRIBUTE,
    useThumbnailCycling
} from "@/lib/hooks/useThumbnailCycling";
import { CollectionSummary } from "@/lib/types/collection-summary";
import { Box, SimpleGrid, Skeleton } from "@chakra-ui/react";
import type { Selection } from "@/lib/hooks/useSelection";
import { useSelectionGestures } from "@/lib/hooks/useSelectionGestures";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SELECTABLE_GRID } from "../grid/selectable-grid";
import { useGridLayout } from "../grid/useGridLayout";
import SelectionMark from "../selection/SelectionMark";
import CollectionCard from "./CollectionCard";

interface CollectionGridProps {
    collections: CollectionSummary[];
    /** Skeleton tiles after the collections, where nothing is known yet */
    skeletons?: number;
    /** Called once the tiles are in the page and before it paints, e.g. to restore the scroll position */
    onLaidOut?: () => void;
    /** Where collections can be selected: a long-press starts selecting */
    selection?: Selection;
}

/** The tight collections grid: hairline gaps and cover-cropped tiles */
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
    const gridRef = useRef<HTMLDivElement | null>(null);
    const [grid, setGrid] = useState<HTMLDivElement | null>(null);
    const setGridRef = useCallback((element: HTMLDivElement | null) => {
        gridRef.current = element;
        setGrid(element);
    }, []);
    useSelectionGestures(grid, CARD_ID_ATTRIBUTE, selection);
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
        <SimpleGrid
            ref={setGridRef}
            columns={columns}
            gap="2px"
            css={selection ? SELECTABLE_GRID : undefined}>
            {collections.map((collection) => (
                <Box
                    key={collection.id}
                    position="relative"
                    h={tileHeights}
                    {...{ [CARD_ID_ATTRIBUTE]: collection.id }}>
                    <CollectionCard
                        collection={collection}
                        frame={cycling.has(collection.id) ? frame : null}
                        onHoverChange={onCardHover}
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

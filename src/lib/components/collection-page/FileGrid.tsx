import { useHoldGesture } from "@/lib/hooks/useHoldGesture";
import type { Selection } from "@/lib/hooks/useSelection";
import { FileSummary } from "@/lib/types/file-summary";
import { chakra, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { useState } from "react";
import FileTile from "../grid/FileTile";
import { HOLDABLE_GRID } from "../grid/holdable-grid";
import { useGridLayout } from "../grid/useGridLayout";
import { FILE_TILE_ATTRIBUTE } from "../lightbox/lightbox-slides";
import SelectionMark from "../selection/SelectionMark";
import { TAB_BAR_HEIGHT } from "../theme/system";
import { TITLE_BAR_HEIGHT } from "./CollectionHero";

interface FileGridProps {
    files: FileSummary[];
    /** Skeleton tiles after the files, where nothing is known yet */
    skeletons?: number;
    /** Tapping a file's tile, e.g. to open it in the lightbox */
    onOpen?: (fileId: string) => void;
    /** Where files can be selected: lifting a hold in place starts selecting, and taps then toggle files instead of opening them */
    selection?: Selection;
}

/** A collection's files in the same tight grid and density as the Collections grid */
export default function FileGrid({
    files,
    skeletons = 0,
    onOpen,
    selection
}: FileGridProps) {
    const layout = useGridLayout();
    const [grid, setGrid] = useState<HTMLDivElement | null>(null);
    useHoldGesture(grid, FILE_TILE_ATTRIBUTE, selection);
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
            {files.map((file) => (
                <chakra.button
                    key={file.id}
                    type="button"
                    aria-label={file.name}
                    aria-pressed={
                        selection?.selecting
                            ? selection.isSelected(file.id)
                            : undefined
                    }
                    {...{ [FILE_TILE_ATTRIBUTE]: file.id }}
                    display="block"
                    position="relative"
                    h={tileHeights}
                    cursor="pointer"
                    // Scrolling a tile into view keeps it clear of the bars
                    scrollMarginTop={`calc(${TITLE_BAR_HEIGHT} + env(safe-area-inset-top))`}
                    scrollMarginBottom={`calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`}
                    onClick={() => onOpen?.(file.id)}>
                    <FileTile file={file} />
                    {selection?.selecting && (
                        <SelectionMark selected={selection.isSelected(file.id)} />
                    )}
                </chakra.button>
            ))}
            {Array.from({ length: skeletons }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} h={tileHeights} rounded="none" />
            ))}
        </SimpleGrid>
    );
}

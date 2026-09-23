import { FileSummary } from "@/lib/types/file-summary";
import { chakra, SimpleGrid, Skeleton } from "@chakra-ui/react";
import FileTile from "../grid/FileTile";
import { useGridLayout } from "../grid/useGridLayout";
import { FILE_TILE_ATTRIBUTE } from "../lightbox/lightbox-slides";
import { TAB_BAR_HEIGHT } from "../theme/system";
import { TITLE_BAR_HEIGHT } from "./CollectionHero";

interface FileGridProps {
    files: FileSummary[];
    /** Skeleton tiles after the files, where nothing is known yet */
    skeletons?: number;
    /** Tapping a file's tile, e.g. to open it in the lightbox */
    onOpen?: (fileId: string) => void;
}

/** A collection's files in the same tight grid and density as the Collections grid */
export default function FileGrid({
    files,
    skeletons = 0,
    onOpen
}: FileGridProps) {
    const layout = useGridLayout();
    if (!layout) {
        return null;
    }
    const { columns, tileHeights } = layout;
    return (
        <SimpleGrid columns={columns} gap="2px">
            {files.map((file) => (
                <chakra.button
                    key={file.id}
                    type="button"
                    aria-label={file.name}
                    {...{ [FILE_TILE_ATTRIBUTE]: file.id }}
                    display="block"
                    h={tileHeights}
                    cursor="pointer"
                    // Scrolling a tile into view keeps it clear of the bars
                    scrollMarginTop={`calc(${TITLE_BAR_HEIGHT} + env(safe-area-inset-top))`}
                    scrollMarginBottom={`calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`}
                    onClick={() => onOpen?.(file.id)}>
                    <FileTile file={file} />
                </chakra.button>
            ))}
            {Array.from({ length: skeletons }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} h={tileHeights} rounded="none" />
            ))}
        </SimpleGrid>
    );
}

import { FileSummary } from "@/lib/types/file-summary";
import { Box, chakra, Flex, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { mdiPlay } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
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

/** A file's thumbnail cropped to fill its tile; a video shows a play mark and its length */
function FileTile({ file }: { file: FileSummary }) {
    const isVideo = file.playbackSrc !== undefined;
    return (
        <Box position="relative" w="100%" h="100%" overflow="hidden" bg="bg.muted">
            <Image
                src={file.thumbnailSrc}
                alt={file.name}
                fill
                // Thumbnails are small already, and decrypted content must
                // not be written to Next.js's image cache
                unoptimized
                placeholder={file.blurDataUrl ? "blur" : "empty"}
                blurDataURL={file.blurDataUrl}
                style={{ objectFit: "cover" }}
            />
            {isVideo && (
                <Flex
                    position="absolute"
                    top="1"
                    right="1"
                    alignItems="center"
                    gap="0.5"
                    px="1"
                    rounded="sm"
                    bg="blackAlpha.600"
                    color="white"
                    fontSize="xs"
                    fontWeight="medium"
                    lineHeight="1.4">
                    <Icon path={mdiPlay} size="14px" aria-hidden />
                    {file.durationInSeconds !== undefined && (
                        <span>{formatDuration(file.durationInSeconds)}</span>
                    )}
                </Flex>
            )}
        </Box>
    );
}

/** m:ss, or h:mm:ss for an hour or more */
export function formatDuration(totalSeconds: number) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

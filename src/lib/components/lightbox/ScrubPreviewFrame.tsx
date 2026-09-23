import type { ScrubPreview } from "@/lib/types/scrub-preview";
import { Box, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { formatPlaybackTime, scrubPreviewTile } from "./video-player";

/** The frame is shown no taller than this, so a portrait video's stays small */
const MAX_FRAME_HEIGHT_PX = 160;

interface ScrubPreviewFrameProps {
    preview: ScrubPreview;
    /** The position being scrubbed to, in seconds */
    time: number;
    /** How far along the progress bar it is, from 0 to 1 */
    progress: number;
}

/**
 * The frame of a Scrub preview for the position being scrubbed to, with its
 * time, above that point of the progress bar. It keeps within the bar's ends.
 * Its parent must be positioned, and as wide as the progress bar.
 */
export default function ScrubPreviewFrame({
    preview,
    time,
    progress
}: ScrubPreviewFrameProps) {
    const { layout, src } = preview;
    const scale = Math.min(1, MAX_FRAME_HEIGHT_PX / layout.tileHeight);
    const width = layout.tileWidth * scale;
    const height = layout.tileHeight * scale;
    const tile = scrubPreviewTile(layout, time);
    return (
        <Box
            position="absolute"
            bottom="100%"
            mb="2"
            left={`clamp(${width / 2}px, ${progress * 100}%, calc(100% - ${width / 2}px))`}
            transform="translateX(-50%)"
            w={`${width}px`}
            h={`${height}px`}
            rounded="md"
            overflow="hidden"
            border="2px solid white"
            boxShadow="0 2px 8px rgba(0, 0, 0, 0.6)"
            bg="black"
            backgroundImage={`url("${src}")`}
            backgroundRepeat="no-repeat"
            backgroundSize={`${layout.columns * width}px ${layout.rows * height}px`}
            backgroundPosition={`${-tile.left * scale}px ${-tile.top * scale}px`}
            pointerEvents="none"
            aria-hidden>
            <Text
                position="absolute"
                bottom="1"
                insetX="0"
                textAlign="center"
                fontSize="xs"
                fontVariantNumeric="tabular-nums"
                color="white"
                textShadow="0 0 3px black">
                {formatPlaybackTime(time)}
            </Text>
        </Box>
    );
}

/** Starts loading a Scrub preview's image, so its frames show as soon as scrubbing starts */
export function usePreloadedScrubPreview(preview: ScrubPreview | undefined) {
    const src = preview?.src;
    useEffect(() => {
        if (!src) return;
        const image = new Image();
        image.src = src;
    }, [src]);
}

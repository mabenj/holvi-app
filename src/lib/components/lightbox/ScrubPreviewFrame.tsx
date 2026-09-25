import type { ScrubPreview } from "@/lib/types/scrub-preview";
import { Box, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { formatPlaybackTime, scrubPreviewTile } from "./video-player";

/** The frame is shown no taller than this, so a portrait video's stays small */
const MAX_FRAME_HEIGHT_PX = 160;

/** Wide enough for the longest time, e.g. "10:00:00" */
const TIME_ONLY_WIDTH_PX = 64;

interface ScrubPreviewFrameProps {
    /** Without one, only the time shows */
    preview?: ScrubPreview;
    /** The position previewed, in seconds */
    time: number;
    /** How far along the progress bar it is, from 0 to 1 */
    progress: number;
}

/**
 * The frame of a Scrub preview for the position being scrubbed to or hovered
 * over, with its time, above that point of the progress bar; only the time
 * for a video without a Scrub preview. It keeps within the bar's ends. Its
 * parent must be positioned, and as wide as the progress bar.
 */
export default function ScrubPreviewFrame({
    preview,
    time,
    progress
}: ScrubPreviewFrameProps) {
    if (!preview) {
        return (
            <Text
                position="absolute"
                bottom="100%"
                mb="2"
                left={centredAt(progress, TIME_ONLY_WIDTH_PX)}
                transform="translateX(-50%)"
                w={`${TIME_ONLY_WIDTH_PX}px`}
                py="0.5"
                rounded="md"
                bg="blackAlpha.700"
                textAlign="center"
                fontSize="xs"
                fontVariantNumeric="tabular-nums"
                color="white"
                pointerEvents="none"
                aria-hidden>
                {formatPlaybackTime(time)}
            </Text>
        );
    }
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
            left={centredAt(progress, width)}
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

/**
 * The left position that centres something this wide over a point of the
 * progress bar, keeping it within the bar's ends
 */
function centredAt(progress: number, width: number) {
    return `clamp(${width / 2}px, ${progress * 100}%, calc(100% - ${width / 2}px))`;
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

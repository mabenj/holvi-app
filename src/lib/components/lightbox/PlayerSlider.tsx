import { Box } from "@chakra-ui/react";
import { PointerEvent, useRef, useState } from "react";
import { fractionAtPointer } from "./video-player";

interface PlayerSliderProps {
    /** 0 to 1 */
    value: number;
    /** Screen readers' name for it, e.g. "Seek" */
    label: string;
    /** Screen readers' reading of the value, e.g. "0:12 of 1:03" */
    valueText: string;
    /** Called as a press or drag moves the value, with the new one */
    onChange: (value: number) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

/**
 * A horizontal slider for the video controls. A press jumps to the pointer
 * and dragging follows it, even off the track. It sits outside PhotoSwipe's
 * gesture area, so dragging it never changes slide.
 */
export default function PlayerSlider({
    value,
    label,
    valueText,
    onChange,
    onDragStart,
    onDragEnd
}: PlayerSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    // The pointer being dragged; events can arrive before a re-render
    const dragPointer = useRef<number | null>(null);

    const valueAt = (event: PointerEvent) => {
        const rect = trackRef.current?.getBoundingClientRect();
        return rect ? fractionAtPointer(event.clientX, rect) : value;
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (dragPointer.current !== null) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragPointer.current = event.pointerId;
        setDragging(true);
        onDragStart?.();
        onChange(valueAt(event));
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerId === dragPointer.current) onChange(valueAt(event));
    };
    const endDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerId !== dragPointer.current) return;
        dragPointer.current = null;
        setDragging(false);
        onDragEnd?.();
    };

    const percent = `${value * 100}%`;
    return (
        <Box
            role="slider"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value * 100)}
            aria-valuetext={valueText}
            position="relative"
            flex="1"
            h="8"
            cursor="pointer"
            // Keeps the browser from scrolling or zooming mid-drag
            touchAction="none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}>
            <Box
                ref={trackRef}
                position="absolute"
                insetX="0"
                top="50%"
                h="1"
                transform="translateY(-50%)"
                rounded="full"
                bg="whiteAlpha.400">
                <Box h="100%" w={percent} rounded="full" bg="white" />
            </Box>
            <Box
                position="absolute"
                top="50%"
                left={percent}
                boxSize={dragging ? "4" : "3"}
                transform="translate(-50%, -50%)"
                rounded="full"
                bg="white"
                boxShadow="0 0 2px rgba(0, 0, 0, 0.6)"
                transition="width 0.1s, height 0.1s"
            />
        </Box>
    );
}

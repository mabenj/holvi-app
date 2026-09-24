import { Box, Spinner } from "@chakra-ui/react";
import { mdiArrowDown } from "@mdi/js";
import Icon from "@mdi/react";
import { ReactNode, useEffect, useRef, useState } from "react";

/** How far the finger must pull, after resistance, to refresh */
const THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;
/** Pull distance per pixel the finger moves, so the pull feels heavy */
const RESISTANCE = 0.5;

interface PullToRefreshProps {
    onRefresh: () => void;
    /** Shows the spinner until the refresh is done */
    refreshing: boolean;
    children: ReactNode;
}

/** Pulling down on a touch screen while at the top of the page refreshes it */
export default function PullToRefresh({
    onRefresh,
    refreshing,
    children
}: PullToRefreshProps) {
    const [pull, setPull] = useState(0);
    const pullRef = useRef(0);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        let startY: number | null = null;

        const setDistance = (distance: number) => {
            pullRef.current = distance;
            setPull(distance);
        };
        const onTouchStart = (event: TouchEvent) => {
            startY =
                window.scrollY <= 0 && event.touches.length === 1
                    ? event.touches[0].clientY
                    : null;
        };
        const onTouchMove = (event: TouchEvent) => {
            // Something on the page, e.g. a held tile, keeps it still
            if (startY === null || event.defaultPrevented) return;
            const moved = event.touches[0].clientY - startY;
            if (moved <= 0 || window.scrollY > 0) {
                setDistance(0);
                return;
            }
            // Stop the page from scrolling while it is being pulled
            if (event.cancelable) event.preventDefault();
            setDistance(Math.min(MAX_PULL_PX, moved * RESISTANCE));
        };
        const onTouchEnd = () => {
            if (startY !== null && pullRef.current >= THRESHOLD_PX) {
                onRefreshRef.current();
            }
            startY = null;
            setDistance(0);
        };

        window.addEventListener("touchstart", onTouchStart, { passive: true });
        // Not passive, so the pull can prevent scrolling
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
        window.addEventListener("touchcancel", onTouchEnd);
        return () => {
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("touchcancel", onTouchEnd);
        };
    }, []);

    const indicatorOffset = refreshing ? THRESHOLD_PX : pull;
    const armed = pull >= THRESHOLD_PX;

    return (
        <>
            <Box
                aria-hidden={!refreshing}
                aria-live="polite"
                position="fixed"
                zIndex="docked"
                left="50%"
                top="calc(env(safe-area-inset-top) - 40px)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxSize="36px"
                rounded="full"
                bg="bg.panel"
                borderWidth="1px"
                shadow="md"
                opacity={indicatorOffset > 0 ? 1 : 0}
                transform={`translate(-50%, ${indicatorOffset}px)`}
                transition={pull > 0 ? "none" : "transform 0.2s, opacity 0.2s"}>
                {refreshing ? (
                    <Spinner size="sm" aria-label="Refreshing" />
                ) : (
                    <Box
                        transform={armed ? "rotate(180deg)" : undefined}
                        transition="transform 0.15s">
                        <Icon path={mdiArrowDown} size="20px" aria-hidden />
                    </Box>
                )}
            </Box>
            {children}
        </>
    );
}

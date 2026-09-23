import type PhotoSwipe from "photoswipe";
import type { AugmentedEvent } from "photoswipe";
import { useEffect, useRef } from "react";
import {
    keyboardAction,
    seekTarget,
    SKIP_SECONDS,
    skipZone
} from "./video-player";

export type SkipDirection = "back" | "forward";

// Keys typed here belong to what has focus, e.g. the actions menu
const KEYBOARD_OWNERS =
    "input, textarea, select, [contenteditable], [role=menu], [role=listbox]";

// Space presses a button or link reached with the keyboard, as usual (the
// player's own buttons take no focus from a mouse press)
const PRESSABLE = "button, a, [role=menuitem]";

/**
 * Double-tapping the left or right third of the active video skips 10 s
 * back or forward, instead of PhotoSwipe's zoom. A double tap in the middle
 * third does nothing. PhotoSwipe tells taps from double taps on touch only;
 * a mouse has the keyboard instead.
 */
export function useDoubleTapSkip(
    pswp: PhotoSwipe,
    video: HTMLVideoElement,
    onSkip: (direction: SkipDirection) => void
) {
    const latestOnSkip = useLatest(onSkip);
    useEffect(() => {
        const onDoubleTap = (event: AugmentedEvent<"doubleTapAction">) => {
            event.preventDefault();
            const direction = skipZone(event.point.x ?? 0, pswp.viewportSize.x);
            if (!direction) return;
            const seconds = direction === "back" ? -SKIP_SECONDS : SKIP_SECONDS;
            video.currentTime = seekTarget(
                video.currentTime,
                seconds,
                video.duration
            );
            latestOnSkip.current(direction);
        };
        pswp.on("doubleTapAction", onDoubleTap);
        return () => pswp.off("doubleTapAction", onDoubleTap);
    }, [pswp, video, latestOnSkip]);
}

/**
 * Desktop keyboard controls for the active video: space and K toggle play,
 * J and L skip 10 s, the left and right arrows seek 5 s instead of changing
 * slide, and the up and down arrows change the volume.
 */
export function useKeyboardControls(
    pswp: PhotoSwipe,
    video: HTMLVideoElement,
    /** Called after a key has acted on the video */
    onUse: () => void
) {
    const latestOnUse = useLatest(onUse);
    useEffect(() => {
        const onKeyDown = (event: AugmentedEvent<"keydown">) => {
            const key = event.originalEvent;
            const action = keyboardAction(key);
            const target = key.target instanceof Element ? key.target : null;
            if (!action || target?.closest(KEYBOARD_OWNERS)) return;
            if (
                action.type === "togglePlay" &&
                key.key === " " &&
                target?.closest(PRESSABLE) &&
                target.matches(":focus-visible")
            ) {
                return;
            }
            // Keeps PhotoSwipe from changing slide, the page from scrolling
            // and a clicked button from being pressed again by space
            event.preventDefault();
            key.preventDefault();
            switch (action.type) {
                case "togglePlay":
                    if (video.paused || video.ended) {
                        video.play().catch(() => undefined);
                    } else {
                        video.pause();
                    }
                    break;
                case "seek":
                    video.currentTime = seekTarget(
                        video.currentTime,
                        action.seconds,
                        video.duration
                    );
                    break;
                case "volume": {
                    const volume = video.muted ? 0 : video.volume;
                    const next = Math.min(
                        1,
                        Math.max(0, volume + action.change)
                    );
                    video.volume = next;
                    video.muted = next === 0;
                    break;
                }
            }
            latestOnUse.current();
        };
        pswp.on("keydown", onKeyDown);
        return () => pswp.off("keydown", onKeyDown);
    }, [pswp, video, latestOnUse]);
}

function useLatest<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

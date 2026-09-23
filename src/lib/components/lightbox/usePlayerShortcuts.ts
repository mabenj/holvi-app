import type PhotoSwipe from "photoswipe";
import type { AugmentedEvent } from "photoswipe";
import { useEffect, useRef } from "react";
import {
    keyboardAction,
    seekTarget,
    setVolume,
    skipSeconds,
    skipZone,
    togglePlay,
    type SkipDirection
} from "./video-player";

// Keys typed here belong to what has focus, e.g. the actions menu
const KEYBOARD_OWNERS =
    "input, textarea, select, [contenteditable], [role=menu], [role=listbox]";

// Space presses a button or link reached with the keyboard, as usual (the
// player's own buttons take no focus from a mouse press)
const PRESSABLE = "button, a, [role=menuitem]";

/**
 * Double-tapping the left or right third of the screen skips the active
 * video 10 s back or forward, instead of PhotoSwipe's zoom. A double tap in the middle
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
            video.currentTime = seekTarget(
                video.currentTime,
                skipSeconds(direction),
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
                    togglePlay(video);
                    break;
                case "seek":
                    video.currentTime = seekTarget(
                        video.currentTime,
                        action.seconds,
                        video.duration
                    );
                    break;
                case "volume":
                    setVolume(
                        video,
                        (video.muted ? 0 : video.volume) + action.change
                    );
                    break;
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

import { useCallback, useSyncExternalStore } from "react";
import type { LightboxFullscreen } from "./lightbox-fullscreen";

export interface FullscreenButton {
    /** Whether the lightbox can go fullscreen with this video, in some way */
    supported: boolean;
    /** Whether it is fullscreen now */
    active: boolean;
    toggle: () => void;
}

/**
 * The fullscreen button's state for a video. It follows the real
 * fullscreen, so exits the browser makes (Esc, its own controls, the native
 * player's Done) show too.
 */
export function useFullscreenButton(
    fullscreen: LightboxFullscreen,
    video: HTMLVideoElement
): FullscreenButton {
    const subscribe = useCallback(
        (onChange: () => void) => {
            document.addEventListener("fullscreenchange", onChange);
            video.addEventListener("webkitbeginfullscreen", onChange);
            video.addEventListener("webkitendfullscreen", onChange);
            return () => {
                document.removeEventListener("fullscreenchange", onChange);
                video.removeEventListener("webkitbeginfullscreen", onChange);
                video.removeEventListener("webkitendfullscreen", onChange);
            };
        },
        [video]
    );
    const active = useSyncExternalStore(
        subscribe,
        () => fullscreen.isActive(video),
        () => false
    );
    return {
        supported: fullscreen.mode(video) !== null,
        active,
        toggle: () => fullscreen.toggle(video)
    };
}

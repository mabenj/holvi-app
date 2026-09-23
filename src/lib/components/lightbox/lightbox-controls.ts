import type PhotoSwipe from "photoswipe";
import { useCallback, useSyncExternalStore } from "react";

/**
 * PhotoSwipe shows its controls (top bar, caption, the video controls) while
 * its root has this class. A tap toggles it on touch; it is the one place the
 * lightbox keeps whether its controls are showing.
 */
const CONTROLS_VISIBLE_CLASS = "pswp--ui-visible";

export function setControlsVisible(pswp: PhotoSwipe, visible: boolean) {
    pswp.element?.classList.toggle(CONTROLS_VISIBLE_CLASS, visible);
}

/** Whether the lightbox's controls are showing, whoever shows or hides them */
export function useControlsVisible(pswp: PhotoSwipe) {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (!pswp.element) return () => undefined;
            const observer = new MutationObserver(onChange);
            observer.observe(pswp.element, {
                attributes: true,
                attributeFilter: ["class"]
            });
            return () => observer.disconnect();
        },
        [pswp]
    );
    return useSyncExternalStore(
        subscribe,
        () => !!pswp.element?.classList.contains(CONTROLS_VISIBLE_CLASS),
        () => false
    );
}

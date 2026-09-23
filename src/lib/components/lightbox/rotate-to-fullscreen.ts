import type PhotoSwipe from "photoswipe";

/** iOS Safari's own video fullscreen, which iPhones use instead of the Fullscreen API */
interface WebKitVideoElement extends HTMLVideoElement {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
    webkitDisplayingFullscreen?: boolean;
}

function isLandscape() {
    if (window.screen.orientation) {
        return window.screen.orientation.type.startsWith("landscape");
    }
    // Older iOS Safari has only the deprecated `window.orientation`
    const angle = (window as { orientation?: number }).orientation;
    return angle === 90 || angle === -90;
}

/**
 * Makes the lightbox fullscreen while the phone is turned to landscape with
 * a video showing, and leaves fullscreen when it is turned back. The whole
 * lightbox goes fullscreen, so the player's controls come along.
 *
 * Browsers without the Fullscreen API for elements (iOS Safari on iPhones)
 * use their native video fullscreen instead, without the player's controls.
 * Browsers may refuse fullscreen that no tap asked for; the video then stays
 * as it is. Chrome on Android allows it on rotation.
 */
export function addRotateToFullscreen(
    pswp: PhotoSwipe,
    /** The active slide's video, if the active slide is a video */
    activeVideo: () => HTMLVideoElement | null
) {
    const onRotate = () => {
        const video = activeVideo() as WebKitVideoElement | null;
        if (isLandscape()) {
            if (video) enterFullscreen(pswp, video);
        } else {
            exitFullscreen(pswp, video);
        }
    };

    const orientation = window.screen.orientation;
    if (orientation) {
        orientation.addEventListener("change", onRotate);
    } else {
        window.addEventListener("orientationchange", onRotate);
    }
    pswp.on("destroy", () => {
        orientation?.removeEventListener("change", onRotate);
        window.removeEventListener("orientationchange", onRotate);
    });
    pswp.on("close", () => exitFullscreen(pswp, null));
}

function enterFullscreen(pswp: PhotoSwipe, video: WebKitVideoElement) {
    const root = pswp.element;
    if (document.fullscreenElement || video.webkitDisplayingFullscreen) {
        return;
    }
    if (document.fullscreenEnabled && root?.requestFullscreen) {
        root.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
    } else if (video.webkitEnterFullscreen) {
        try {
            video.webkitEnterFullscreen();
        } catch {
            // Refused without a tap
        }
    }
}

function exitFullscreen(pswp: PhotoSwipe, video: WebKitVideoElement | null) {
    if (pswp.element && document.fullscreenElement === pswp.element) {
        document.exitFullscreen().catch(() => undefined);
    }
    if (video?.webkitDisplayingFullscreen) {
        video.webkitExitFullscreen?.();
    }
}

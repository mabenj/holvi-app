/**
 * How the lightbox goes fullscreen: the whole lightbox (the Fullscreen API
 * for elements), or the browser's own video fullscreen, which iPhones use
 * because they have no element fullscreen
 */
export type FullscreenMode = "element" | "video";

/** What started a fullscreen: turning the phone, or the fullscreen button */
export type FullscreenOrigin = "rotation" | "button";

/** Which way the screen is locked during a fullscreen */
export type OrientationLock = "landscape" | "portrait";

/** What turning the phone does to the lightbox's fullscreen */
export type RotationAction = "enter" | "exit";

/**
 * How the lightbox can go fullscreen, if at all: the whole lightbox where
 * the browser allows it, so the player's controls and swiping come along,
 * or else the native video fullscreen
 */
export function fullscreenMode(support: {
    /** Whether the Fullscreen API for elements is available and allowed */
    element: boolean;
    /** Whether the video has the native video fullscreen (`webkitEnterFullscreen`) */
    video: boolean;
}): FullscreenMode | null {
    if (support.element) return "element";
    if (support.video) return "video";
    return null;
}

/**
 * Which way to lock the screen for a fullscreen, if at all: to the video's
 * own orientation for one the button started. A fullscreen that turning the
 * phone started is not locked, so turning it back can still end it. A square
 * video, or one whose size is not known yet, leaves the screen as it is.
 */
export function orientationLock(
    origin: FullscreenOrigin,
    video: { width: number; height: number }
): OrientationLock | null {
    if (origin !== "button") return null;
    if (video.width > video.height) return "landscape";
    if (video.height > video.width) return "portrait";
    return null;
}

/**
 * What turning the phone does: turning it to landscape with a video showing
 * starts a fullscreen, and turning it back to portrait ends a fullscreen only
 * if turning it started that one. A fullscreen the button started lasts
 * until the button, Esc or the browser ends it, or the lightbox closes.
 */
export function rotationAction({
    landscape,
    onVideo,
    origin
}: {
    /** Whether the screen is now in landscape */
    landscape: boolean;
    /** Whether the active slide is a video */
    onVideo: boolean;
    /** What started the current fullscreen, or one being asked for, or null if there is none */
    origin: FullscreenOrigin | null;
}): RotationAction | null {
    if (landscape) {
        return onVideo && origin === null ? "enter" : null;
    }
    return origin === "rotation" ? "exit" : null;
}

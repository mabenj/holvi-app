import type PhotoSwipe from "photoswipe";
import { useCallback, useSyncExternalStore } from "react";
import {
    FullscreenOrigin,
    fullscreenMode,
    orientationLock,
    rotationAction
} from "./fullscreen";

/** iOS Safari's own video fullscreen, which iPhones use instead of the Fullscreen API */
interface WebKitVideoElement extends HTMLVideoElement {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
    webkitDisplayingFullscreen?: boolean;
}

/** `screen.orientation.lock`, which TypeScript's DOM types leave out */
interface LockableOrientation extends ScreenOrientation {
    lock?: (orientation: "landscape" | "portrait") => Promise<void>;
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
 * The lightbox's fullscreen, which turning the phone and the video player's
 * fullscreen button share. The whole lightbox goes fullscreen, so the
 * player's controls, the top bar and swiping come along, and it stays
 * fullscreen on swiping to other files. Browsers without the Fullscreen API
 * for elements (iOS Safari on iPhones) use their native video fullscreen
 * instead, without the player's controls.
 *
 * It keeps what started the current fullscreen: turning the phone back to
 * portrait ends only one that turning it started (see `rotationAction`).
 * One the button started locks the screen to the video's orientation where
 * the browser allows it, until it ends.
 */
export class LightboxFullscreen {
    /** What started the fullscreen last asked for */
    private origin: FullscreenOrigin | null = null;
    /** Whether the screen's orientation is locked, or asked to be */
    private locked = false;

    constructor(private readonly pswp: PhotoSwipe) {}

    /** How this video can go fullscreen here, if at all */
    mode(video: HTMLVideoElement) {
        const root = this.pswp.element;
        return fullscreenMode({
            element:
                document.fullscreenEnabled === true &&
                typeof root?.requestFullscreen === "function",
            video:
                typeof (video as WebKitVideoElement).webkitEnterFullscreen ===
                "function"
        });
    }

    /** Whether the lightbox, or this video natively, is fullscreen now */
    isActive(video: HTMLVideoElement | null) {
        const root = this.pswp.element;
        return (
            (!!root && document.fullscreenElement === root) ||
            !!(video as WebKitVideoElement | null)?.webkitDisplayingFullscreen
        );
    }

    /** The fullscreen button's action: enters fullscreen, or leaves it */
    toggle(video: HTMLVideoElement) {
        if (this.isActive(video)) {
            this.exit(video);
        } else {
            this.enter(video, "button");
        }
    }

    /**
     * Makes the lightbox fullscreen with this video showing. Browsers may
     * refuse a fullscreen that no tap asked for, e.g. one on rotation; the
     * video then stays as it is.
     */
    enter(video: HTMLVideoElement, origin: FullscreenOrigin) {
        if (document.fullscreenElement || this.isActive(video)) return;
        const root = this.pswp.element;
        const mode = this.mode(video);
        if (mode === "element" && root) {
            this.origin = origin;
            const lock = orientationLock(origin, {
                width: video.videoWidth,
                height: video.videoHeight
            });
            root.requestFullscreen({ navigationUI: "hide" }).then(
                () => {
                    if (lock) this.lockOrientation(lock);
                },
                () => undefined
            );
        } else if (mode === "video") {
            this.origin = origin;
            try {
                (video as WebKitVideoElement).webkitEnterFullscreen?.();
            } catch {
                // Refused, e.g. without a tap or before the video has loaded
            }
        }
    }

    /** Leaves fullscreen, whatever started it */
    exit(video: HTMLVideoElement | null) {
        const root = this.pswp.element;
        if (root && document.fullscreenElement === root) {
            document.exitFullscreen().catch(() => undefined);
        }
        const webkitVideo = video as WebKitVideoElement | null;
        if (webkitVideo?.webkitDisplayingFullscreen) {
            webkitVideo.webkitExitFullscreen?.();
        }
    }

    /** Turning the phone changed the screen's orientation */
    rotated(activeVideo: HTMLVideoElement | null) {
        const action = rotationAction({
            landscape: isLandscape(),
            onVideo: activeVideo !== null,
            // What started a fullscreen that is on now: a request that was
            // refused, or one that has ended, counts for nothing
            origin: this.isActive(activeVideo) ? this.origin : null
        });
        if (action === "enter" && activeVideo) {
            this.enter(activeVideo, "rotation");
        } else if (action === "exit") {
            this.exit(activeVideo);
        }
    }

    /** Releases the orientation lock once fullscreen has ended */
    releaseLockUnlessActive() {
        const root = this.pswp.element;
        if (root && document.fullscreenElement === root) return;
        if (!this.locked) return;
        this.locked = false;
        try {
            window.screen.orientation?.unlock();
        } catch {
            // Nothing was locked after all
        }
    }

    private lockOrientation(lock: "landscape" | "portrait") {
        const orientation = window.screen.orientation as
            | LockableOrientation
            | undefined;
        if (!orientation?.lock) return;
        this.locked = true;
        // Browsers that can't lock (iOS, desktops) reject, which leaves the
        // screen as it is
        orientation.lock(lock).catch(() => {
            this.locked = false;
        });
    }
}

/**
 * Adds the lightbox's fullscreen: turning the phone to landscape with a
 * video showing makes it fullscreen, turning it back ends a fullscreen that
 * turning it started, and closing the lightbox ends any fullscreen. The
 * player's fullscreen button drives the returned `LightboxFullscreen`.
 */
export function addLightboxFullscreen(
    pswp: PhotoSwipe,
    /** The active slide's video, if the active slide is a video */
    activeVideo: () => HTMLVideoElement | null
) {
    const fullscreen = new LightboxFullscreen(pswp);

    const onRotate = () => fullscreen.rotated(activeVideo());
    const onFullscreenChange = () => fullscreen.releaseLockUnlessActive();
    const orientation = window.screen.orientation;
    if (orientation) {
        orientation.addEventListener("change", onRotate);
    } else {
        window.addEventListener("orientationchange", onRotate);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    pswp.on("destroy", () => {
        orientation?.removeEventListener("change", onRotate);
        window.removeEventListener("orientationchange", onRotate);
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        fullscreen.releaseLockUnlessActive();
    });
    pswp.on("close", () => fullscreen.exit(activeVideo()));
    // Browsers keep Esc to themselves in fullscreen, to leave it. One that
    // lets it through leaves fullscreen too, rather than closing the lightbox.
    pswp.on("keydown", (event) => {
        const video = activeVideo();
        if (event.originalEvent.key === "Escape" && fullscreen.isActive(video)) {
            event.preventDefault();
            fullscreen.exit(video);
        }
    });
    return fullscreen;
}

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

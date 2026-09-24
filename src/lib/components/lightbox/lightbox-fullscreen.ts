import type PhotoSwipe from "photoswipe";
import {
    type FullscreenOrigin,
    fullscreenMode,
    type OrientationLock,
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
    lock?: (orientation: OrientationLock) => Promise<void>;
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
    /** What started the current fullscreen, or the one being asked for */
    private origin: FullscreenOrigin | null = null;
    /** Whether the lightbox has asked for fullscreen and not heard back yet */
    private requesting = false;
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
        return (
            this.isLightboxFullscreen() ||
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
        if (
            this.requesting ||
            document.fullscreenElement ||
            this.isActive(video)
        ) {
            return;
        }
        const root = this.pswp.element;
        const mode = this.mode(video);
        if (mode === "element" && root) {
            this.origin = origin;
            this.requesting = true;
            const lock = orientationLock(origin, this.videoSize(video));
            root.requestFullscreen({ navigationUI: "hide" }).then(
                () => {
                    this.requesting = false;
                    if (lock && this.isLightboxFullscreen()) {
                        this.lockOrientation(lock);
                    }
                },
                () => {
                    this.requesting = false;
                    this.fullscreenChanged();
                }
            );
        } else if (mode === "video") {
            this.origin = origin;
            video.addEventListener(
                "webkitendfullscreen",
                () => this.fullscreenChanged(),
                { once: true }
            );
            try {
                (video as WebKitVideoElement).webkitEnterFullscreen?.();
            } catch {
                // Refused, e.g. without a tap or before the video has loaded
                this.origin = null;
            }
        }
    }

    /** Leaves fullscreen, whatever started it */
    exit(video: HTMLVideoElement | null) {
        if (this.isLightboxFullscreen()) {
            document.exitFullscreen().catch(() => undefined);
        }
        const webkitVideo = video as WebKitVideoElement | null;
        if (webkitVideo?.webkitDisplayingFullscreen) {
            webkitVideo.webkitExitFullscreen?.();
        }
    }

    /** Handles turning the phone, with this video on the active slide */
    handleRotation(activeVideo: HTMLVideoElement | null) {
        const action = rotationAction({
            landscape: isLandscape(),
            onVideo: activeVideo !== null,
            // A native video fullscreen that was refused without a word
            // leaves an origin behind, which counts for nothing
            origin:
                this.requesting || this.isActive(activeVideo)
                    ? this.origin
                    : null
        });
        if (action === "enter" && activeVideo) {
            this.enter(activeVideo, "rotation");
        } else if (action === "exit") {
            this.exit(activeVideo);
        }
    }

    /**
     * The document's fullscreen may have changed, whoever changed it: once
     * the lightbox's has ended, forgets what started it and releases the
     * screen's orientation
     */
    fullscreenChanged() {
        if (this.requesting || this.isLightboxFullscreen()) return;
        this.origin = null;
        this.releaseLock();
    }

    /** Releases the screen's orientation, if the lightbox locked it */
    releaseLock() {
        if (!this.locked) return;
        this.locked = false;
        try {
            window.screen.orientation?.unlock();
        } catch {
            // Nothing was locked after all
        }
    }

    private isLightboxFullscreen() {
        const root = this.pswp.element;
        return !!root && document.fullscreenElement === root;
    }

    /**
     * The video's size, or before its metadata has loaded, the file's, which
     * the active slide carries
     */
    private videoSize(video: HTMLVideoElement) {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            return { width: video.videoWidth, height: video.videoHeight };
        }
        const slide = this.pswp.currSlide?.data;
        return { width: slide?.width ?? 0, height: slide?.height ?? 0 };
    }

    private lockOrientation(lock: OrientationLock) {
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

    const onRotate = () => fullscreen.handleRotation(activeVideo());
    const onFullscreenChange = () => fullscreen.fullscreenChanged();
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
        // Its element leaves the page, which ends any fullscreen it had
        fullscreen.releaseLock();
    });
    pswp.on("close", () => fullscreen.exit(activeVideo()));
    // Browsers keep Esc to themselves in fullscreen, to leave it. One that
    // lets it through leaves fullscreen too, rather than closing the lightbox.
    pswp.on("keydown", (event) => {
        const video = activeVideo();
        if (
            event.originalEvent.key === "Escape" &&
            fullscreen.isActive(video)
        ) {
            event.preventDefault();
            fullscreen.exit(video);
        }
    });
    return fullscreen;
}

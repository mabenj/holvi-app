import type PhotoSwipe from "photoswipe";
import { setControlsVisible } from "./lightbox-controls";
import type { FileSlideData } from "./lightbox-slides";
import { isTap } from "./video-player";
import { applyVideoSettings, saveVideoSettings } from "./video-settings";

/** Class of a video slide's element, which holds its video */
const VIDEO_SLIDE_CLASS = "holvi-video-slide";

interface VideoSlideEvents {
    /** A video became the active slide */
    onActivate: (video: HTMLVideoElement, fileId: string) => void;
    /** A video stopped being the active slide, or is gone */
    onDeactivate: (video: HTMLVideoElement) => void;
}

function videoOf(content: { element?: HTMLElement }) {
    return content.element?.querySelector("video") ?? null;
}

/**
 * Makes video files slides with a bare video element, which the player's
 * controls (`VideoControls`) drive while it is the active slide. The active
 * video plays with the viewer's remembered volume and the others are paused,
 * so audio never plays from a hidden slide.
 *
 * The video has no native controls, so PhotoSwipe's gestures work on it as
 * on images: a horizontal drag changes slide, a vertical drag closes, and a
 * tap toggles the controls.
 */
export function addVideoSlides(pswp: PhotoSwipe, events: VideoSlideEvents) {
    pswp.on("contentLoad", (event) => {
        const { content } = event;
        const data = content.data as FileSlideData;
        if (data.type !== "video") return;
        event.preventDefault();
        const video = document.createElement("video");
        video.style.width = "100%";
        video.style.height = "100%";
        video.src = data.videoSrc ?? "";
        video.poster = data.msrc ?? "";
        video.playsInline = true;
        video.preload = "metadata";
        // Takes the thumbnail placeholder away once a frame can show, as
        // PhotoSwipe does for images; it would otherwise stay underneath
        video.addEventListener("loadeddata", () => content.onLoaded(), {
            once: true
        });
        video.addEventListener("volumechange", () => {
            // Only the viewer changes the active video's volume; the others
            // are given the remembered one when they become active
            if (pswp.currSlide?.content === content) {
                saveVideoSettings({ volume: video.volume, muted: video.muted });
            }
        });
        // PhotoSwipe sizes the slide's element to fit; the video fills it
        const element = document.createElement("div");
        element.className = `pswp__content ${VIDEO_SLIDE_CLASS}`;
        element.append(video);
        content.element = element;
    });

    pswp.on("contentActivate", ({ content }) => {
        const video = videoOf(content);
        if (!video) return;
        applyVideoSettings(video);
        events.onActivate(video, (content.data as FileSlideData).fileId);
        video.play().catch(() => {
            // Autoplay with sound can be refused, e.g. by a browser that has
            // not seen the viewer interact yet: show the play button instead
            if (pswp.currSlide?.content === content) {
                setControlsVisible(pswp, true);
            }
        });
    });
    pswp.on("contentDeactivate", ({ content }) => {
        const video = videoOf(content);
        if (!video) return;
        video.pause();
        events.onDeactivate(video);
    });
    pswp.on("contentRemove", ({ content }) => videoOf(content)?.pause());
    pswp.on("contentDestroy", ({ content }) => {
        const video = videoOf(content);
        if (!video) return;
        video.pause();
        events.onDeactivate(video);
        // Stops the download of a video that is no longer shown
        video.removeAttribute("src");
        video.load();
    });

    // The zoom from the thumbnail uses its placeholder, as for images
    pswp.addFilter(
        "useContentPlaceholder",
        (use, content) =>
            use || (content.data as FileSlideData).type === "video"
    );

    // On touch, PhotoSwipe's tap toggles the controls anywhere on a slide.
    // With a mouse, moving it shows them (see `VideoControls`), so a click
    // only shows them too: toggling would hide what the move to the video
    // had just shown. A click that ends a drag does nothing.
    let pressedAt: { x: number; y: number } | null = null;
    pswp.on("pointerDown", ({ originalEvent }) => {
        pressedAt = { x: originalEvent.clientX, y: originalEvent.clientY };
    });
    pswp.on("pointerUp", ({ originalEvent }) => {
        const down = pressedAt;
        pressedAt = null;
        if (
            down &&
            originalEvent.pointerType === "mouse" &&
            originalEvent.target instanceof Element &&
            originalEvent.target.closest(`.${VIDEO_SLIDE_CLASS}`) &&
            isTap(down, { x: originalEvent.clientX, y: originalEvent.clientY })
        ) {
            setControlsVisible(pswp, true);
        }
    });
}

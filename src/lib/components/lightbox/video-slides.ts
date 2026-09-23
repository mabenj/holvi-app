import type PhotoSwipe from "photoswipe";
import type { FileSlideData } from "./lightbox-slides";

/** Pointers this close to a video's bottom edge work its controls instead of swiping */
const CONTROLS_HEIGHT_PX = 64;

function videoOf(content: { element?: HTMLElement }) {
    return content.element?.querySelector("video") ?? null;
}

/**
 * Plays video files in a plain video element inside their slide. The active
 * video plays; the others are paused. A stand-in until the custom player.
 */
export function addVideoSlides(pswp: PhotoSwipe) {
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
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("controlsList", "nodownload");
        // PhotoSwipe sizes the slide's element to fit; the video fills it
        const element = document.createElement("div");
        element.className = "pswp__content";
        element.append(video);
        content.element = element;
    });

    pswp.on("contentActivate", ({ content }) => {
        videoOf(content)
            ?.play()
            // Autoplay can be refused, e.g. with sound after a swipe; the
            // controls still work
            .catch(() => undefined);
    });
    pswp.on("contentDeactivate", ({ content }) => videoOf(content)?.pause());
    pswp.on("contentRemove", ({ content }) => videoOf(content)?.pause());
    pswp.on("contentDestroy", ({ content }) => {
        const video = videoOf(content);
        if (!video) return;
        video.pause();
        // Stops the download of a video that is no longer shown
        video.removeAttribute("src");
        video.load();
    });

    // The zoom from the thumbnail uses its placeholder, as for images
    pswp.addFilter(
        "useContentPlaceholder",
        (use, content) => use || (content.data as FileSlideData).type === "video"
    );

    // The native controls sit at the bottom of the video: let them have the
    // pointer there rather than starting a swipe
    pswp.on("pointerDown", (event) => {
        const target = event.originalEvent.target;
        if (!(target instanceof HTMLVideoElement)) return;
        const { bottom } = target.getBoundingClientRect();
        if (bottom - event.originalEvent.clientY <= CONTROLS_HEIGHT_PX) {
            event.preventDefault();
        }
    });
}

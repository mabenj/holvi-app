import type { ScrubPreviewLayout } from "@/lib/types/scrub-preview";

/** How long playback runs with the controls showing before they hide by themselves */
export const CONTROLS_AUTO_HIDE_MS = 3000;

/** A press that moves further than this is a drag, not a tap */
const TAP_DISTANCE_PX = 10;

/** A playback position or duration, e.g. "1:15" or "1:02:03" */
export function formatPlaybackTime(seconds: number) {
    if (!Number.isFinite(seconds)) {
        return "-:--";
    }
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = String(total % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
        : `${minutes}:${secs}`;
}

/** How far along a horizontal track, from 0 to 1, a pointer is */
export function fractionAtPointer(
    clientX: number,
    track: { left: number; width: number }
) {
    if (track.width <= 0) {
        return 0;
    }
    return Math.min(1, Math.max(0, (clientX - track.left) / track.width));
}

/** Whether a press released here, after starting there, is a tap */
export function isTap(
    down: { x: number; y: number },
    up: { x: number; y: number }
) {
    return Math.hypot(up.x - down.x, up.y - down.y) < TAP_DISTANCE_PX;
}

/** How far a double tap skips, in seconds */
export const SKIP_SECONDS = 10;

/** How far the left and right arrow keys seek, in seconds */
const ARROW_SEEK_SECONDS = 5;

/** How much the up and down arrow keys change the volume, from 0 to 1 */
const ARROW_VOLUME_CHANGE = 0.1;

export type SkipDirection = "back" | "forward";

/** How far a skip in this direction moves, in seconds */
export function skipSeconds(direction: SkipDirection) {
    return direction === "back" ? -SKIP_SECONDS : SKIP_SECONDS;
}

/**
 * Which way a double tap this far across the screen skips: back on its left
 * third, forward on its right third, and not at all in between. Thirds of
 * the screen rather than of the video, so a narrow video's are wide enough.
 */
export function skipZone(x: number, width: number): SkipDirection | null {
    if (x < width / 3) return "back";
    if (x > (width * 2) / 3) return "forward";
    return null;
}

/** The position after moving by some seconds, kept within the video */
export function seekTarget(current: number, seconds: number, duration: number) {
    const target = Math.max(0, current + seconds);
    return Number.isFinite(duration) ? Math.min(duration, target) : target;
}

export type KeyboardAction =
    | { type: "togglePlay" }
    | { type: "seek"; seconds: number }
    | { type: "volume"; change: number };

/**
 * What a key press does to the active video: space and K toggle play, J and
 * L skip back and forward, the left and right arrows seek, and the up and
 * down arrows change the volume. Presses with Ctrl, Cmd or Alt are the
 * browser's.
 */
export function keyboardAction(event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}): KeyboardAction | null {
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    switch (event.key.length === 1 ? event.key.toLowerCase() : event.key) {
        case " ":
        case "k":
            return { type: "togglePlay" };
        case "j":
            return { type: "seek", seconds: skipSeconds("back") };
        case "l":
            return { type: "seek", seconds: skipSeconds("forward") };
        case "ArrowLeft":
            return { type: "seek", seconds: -ARROW_SEEK_SECONDS };
        case "ArrowRight":
            return { type: "seek", seconds: ARROW_SEEK_SECONDS };
        case "ArrowUp":
            return { type: "volume", change: ARROW_VOLUME_CHANGE };
        case "ArrowDown":
            return { type: "volume", change: -ARROW_VOLUME_CHANGE };
        default:
            return null;
    }
}

/** Plays a paused or finished video, and pauses a playing one */
export function togglePlay(video: HTMLVideoElement) {
    if (video.paused || video.ended) {
        // A refused play leaves the play button showing, which says enough
        video.play().catch(() => undefined);
    } else {
        video.pause();
    }
}

/** Sets a video's volume, from 0 to 1; none at all is muted */
export function setVolume(video: HTMLVideoElement, volume: number) {
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = video.volume === 0;
}

/**
 * Where in a Scrub preview's image the frame for a playback position sits,
 * in pixels from its top left: the last frame sampled at or before it.
 */
export function scrubPreviewTile(layout: ScrubPreviewLayout, seconds: number) {
    const sampled = Math.floor(seconds / layout.intervalSeconds);
    const frame = Number.isFinite(sampled)
        ? Math.min(layout.frames - 1, Math.max(0, sampled))
        : 0;
    return {
        left: (frame % layout.columns) * layout.tileWidth,
        top: Math.floor(frame / layout.columns) * layout.tileHeight
    };
}

/** What the progress bar previews above itself */
export interface ProgressPreview {
    /** The position previewed, in seconds */
    time: number;
    /** How far along the bar it is, from 0 to 1 */
    fraction: number;
}

/**
 * What the progress bar previews, if anything: the position a press or drag
 * has moved to, or else the one under a hovering mouse. Hovering never seeks.
 * A mouse over the bar sees the Scrub preview's frame with the time, or only
 * the time for a video without one. Touch has no hover, so it previews only
 * while dragging, and only with a Scrub preview.
 */
export function progressPreview({
    duration,
    hasScrubPreview,
    dragTime,
    hoverFraction
}: {
    duration: number;
    hasScrubPreview: boolean;
    /** Where a press or drag has moved playback to, in seconds, while one is under way */
    dragTime: number | null;
    /** How far along the bar a hovering mouse is, from 0 to 1, while it is over it */
    hoverFraction: number | null;
}): ProgressPreview | null {
    if (!Number.isFinite(duration) || duration <= 0) return null;
    if (!hasScrubPreview && hoverFraction === null) return null;
    if (dragTime !== null) {
        const fraction = Math.min(1, Math.max(0, dragTime / duration));
        return { time: dragTime, fraction };
    }
    if (hoverFraction === null) return null;
    return { time: hoverFraction * duration, fraction: hoverFraction };
}

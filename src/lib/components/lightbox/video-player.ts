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

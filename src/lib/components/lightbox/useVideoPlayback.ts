import { useEffect, useState } from "react";

export interface VideoPlayback {
    paused: boolean;
    ended: boolean;
    /** Seconds */
    currentTime: number;
    /** Seconds; NaN until the video's metadata has loaded */
    duration: number;
    volume: number;
    muted: boolean;
}

function snapshot(video: HTMLVideoElement): VideoPlayback {
    return {
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: video.duration,
        volume: video.volume,
        muted: video.muted
    };
}

const EVENTS = [
    "play",
    "pause",
    "ended",
    "seeking",
    "seeked",
    "timeupdate",
    "durationchange",
    "loadedmetadata",
    "volumechange"
];

/**
 * A video element's playback state, kept up to date. The position updates
 * every frame while it plays, so a progress bar moves smoothly.
 */
export function useVideoPlayback(video: HTMLVideoElement): VideoPlayback {
    const [playback, setPlayback] = useState(() => snapshot(video));

    useEffect(() => {
        const update = () => setPlayback(snapshot(video));
        update();
        EVENTS.forEach((name) => video.addEventListener(name, update));
        return () =>
            EVENTS.forEach((name) => video.removeEventListener(name, update));
    }, [video]);

    const playing = !playback.paused;
    useEffect(() => {
        if (!playing) return;
        let frame = requestAnimationFrame(function tick() {
            setPlayback(snapshot(video));
            frame = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(frame);
    }, [video, playing]);

    return playback;
}

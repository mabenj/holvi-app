/** How loud videos play, remembered per viewer across videos and reloads */
export interface VideoSettings {
    /** 0 to 1 */
    volume: number;
    muted: boolean;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
    volume: 1,
    muted: false
};

// The previous UI's key and shape, so a viewer's choice carries over
const STORAGE_KEY = "holvi.videoControls";

/** The settings a stored value holds, or the defaults for what it lacks */
export function parseVideoSettings(json: string | null): VideoSettings {
    let stored: unknown;
    try {
        stored = json === null ? null : JSON.parse(json);
    } catch {
        return DEFAULT_VIDEO_SETTINGS;
    }
    if (typeof stored !== "object" || stored === null) {
        return DEFAULT_VIDEO_SETTINGS;
    }
    const { volume, isMuted } = stored as Record<string, unknown>;
    return {
        volume:
            typeof volume === "number" && volume >= 0 && volume <= 1
                ? volume
                : DEFAULT_VIDEO_SETTINGS.volume,
        muted:
            typeof isMuted === "boolean"
                ? isMuted
                : DEFAULT_VIDEO_SETTINGS.muted
    };
}

export function serializeVideoSettings({ volume, muted }: VideoSettings) {
    return JSON.stringify({ volume, isMuted: muted });
}

export function readVideoSettings(): VideoSettings {
    try {
        return parseVideoSettings(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        // Storage can be unavailable, e.g. in some private windows
        return DEFAULT_VIDEO_SETTINGS;
    }
}

export function saveVideoSettings(settings: VideoSettings) {
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            serializeVideoSettings(settings)
        );
    } catch {
        // Without storage the choice lasts until the video is closed
    }
}

/** Gives a video the viewer's remembered volume and mute */
export function applyVideoSettings(video: HTMLVideoElement) {
    const { volume, muted } = readVideoSettings();
    video.volume = volume;
    video.muted = muted;
}

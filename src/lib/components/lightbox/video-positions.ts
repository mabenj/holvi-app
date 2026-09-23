/**
 * Where playback of each longer video stopped, remembered per viewer in
 * browser storage, so reopening a video resumes there. A file's position is
 * cleared when its playback reaches the end.
 */
export type VideoPositions = ReadonlyMap<string, number>;

/** Videos at most this long, in seconds, start from the beginning every time */
const RESUME_MIN_DURATION_S = 60;

/** Beyond this many files, the least recently watched are forgotten */
export const MAX_REMEMBERED_POSITIONS = 200;

const STORAGE_KEY = "holvi.videoPositions";

/** Whether a video this long, in seconds, has its position remembered */
export function isLongEnoughToResume(duration: number) {
    return Number.isFinite(duration) && duration > RESUME_MIN_DURATION_S;
}

/** Stored as [fileId, seconds] pairs, least recently watched first */
export function parseVideoPositions(json: string | null): VideoPositions {
    let stored: unknown;
    try {
        stored = json === null ? null : JSON.parse(json);
    } catch {
        return new Map();
    }
    if (!Array.isArray(stored)) {
        return new Map();
    }
    return new Map(
        stored.filter(
            (entry): entry is [string, number] =>
                Array.isArray(entry) &&
                typeof entry[0] === "string" &&
                typeof entry[1] === "number" &&
                Number.isFinite(entry[1]) &&
                entry[1] >= 0
        )
    );
}

export function serializeVideoPositions(positions: VideoPositions) {
    return JSON.stringify(Array.from(positions));
}

/** The positions with a file's replaced, as the most recently watched */
export function rememberPosition(
    positions: VideoPositions,
    fileId: string,
    seconds: number
): VideoPositions {
    const next = new Map(positions);
    next.delete(fileId);
    next.set(fileId, seconds);
    const excess = next.size - MAX_REMEMBERED_POSITIONS;
    Array.from(next.keys())
        .slice(0, Math.max(0, excess))
        .forEach((oldest) => next.delete(oldest));
    return next;
}

export function forgetPosition(
    positions: VideoPositions,
    fileId: string
): VideoPositions {
    const next = new Map(positions);
    next.delete(fileId);
    return next;
}

function readPositions() {
    try {
        return parseVideoPositions(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        // Storage can be unavailable, e.g. in some private windows
        return new Map<string, number>();
    }
}

function writePositions(positions: VideoPositions) {
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            serializeVideoPositions(positions)
        );
    } catch {
        // Without storage the video starts from the beginning next time
    }
}

/** Where a file's playback stopped last time, if it is remembered */
export function readSavedPosition(fileId: string): number | undefined {
    return readPositions().get(fileId);
}

export function savePosition(fileId: string, seconds: number) {
    writePositions(rememberPosition(readPositions(), fileId, seconds));
}

export function clearSavedPosition(fileId: string) {
    const positions = readPositions();
    if (positions.has(fileId)) {
        writePositions(forgetPosition(positions, fileId));
    }
}

/** Keeps a video's remembered position up to date while it plays */
export interface PositionTracker {
    /** Remembers the position now, e.g. before the video is taken away */
    save: () => void;
    /** Stops remembering, e.g. before the video is emptied */
    stop: () => void;
}

/**
 * Resumes a video where its playback stopped last time, then remembers its
 * position as it plays, pauses and seeks, and forgets it once playback
 * reaches the end or while the video loops. Call it when the video becomes the active slide, so a
 * neighbouring slide's video never overwrites the position before it has
 * been resumed.
 */
export function resumeAndTrackPosition(
    video: HTMLVideoElement,
    fileId: string
): PositionTracker {
    const listening = new AbortController();
    const options = { signal: listening.signal };

    const saved = readSavedPosition(fileId);
    if (saved !== undefined) {
        const resume = () => {
            video.currentTime = saved;
        };
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resume();
        } else {
            video.addEventListener("loadedmetadata", resume, {
                ...options,
                once: true
            });
        }
    }

    let savedAt = saved ?? 0;
    const save = () => {
        if (listening.signal.aborted) return;
        // A looping video keeps reaching its end without ending
        if (video.ended || video.loop) {
            clearSavedPosition(fileId);
        } else if (isLongEnoughToResume(video.duration)) {
            savedAt = video.currentTime;
            savePosition(fileId, savedAt);
        }
    };
    // Every second of playback, so a reload or a closed tab loses little
    video.addEventListener(
        "timeupdate",
        () => Math.abs(video.currentTime - savedAt) >= 1 && save(),
        options
    );
    video.addEventListener("pause", save, options);
    video.addEventListener("seeked", save, options);
    video.addEventListener("ended", save, options);
    return { save, stop: () => listening.abort() };
}

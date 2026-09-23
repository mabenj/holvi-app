import { VideoProcessingStatus } from "../types/video-processing-status";

export const VIDEO_PROCESSING_URL = "/api/video-processing";

// No JSON content type: the API routes parse the raw body themselves
async function request(method: string, fallbackError: string) {
    const res = await fetch(VIDEO_PROCESSING_URL, { method });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
        throw new Error(data.error || fallbackError);
    }
    return data.processing as VideoProcessingStatus;
}

/** How far video processing has got with the user's videos */
export function getVideoProcessingStatus() {
    return request("GET", "Could not load video processing");
}

/** Queues the user's videos that were never processed or failed */
export function processVideos() {
    return request("POST", "Could not start video processing");
}

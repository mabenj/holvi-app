import {
    FailedVideo,
    VideoProcessingStatus
} from "../types/video-processing-status";

export const VIDEO_PROCESSING_URL = "/api/video-processing";

export const FAILED_VIDEOS_URL = `${VIDEO_PROCESSING_URL}/failed`;

// No JSON content type: the API routes parse the raw body themselves
async function request<T>(method: string, url: string, fallbackError: string) {
    const res = await fetch(url, { method });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
        throw new Error(data.error || fallbackError);
    }
    return data as T;
}

/** How far video processing has got with the user's videos */
export async function getVideoProcessingStatus() {
    const { processing } = await request<{ processing: VideoProcessingStatus }>(
        "GET",
        VIDEO_PROCESSING_URL,
        "Could not load video processing"
    );
    return processing;
}

/** Queues the user's videos that were never processed or failed */
export async function processVideos() {
    const { processing } = await request<{ processing: VideoProcessingStatus }>(
        "POST",
        VIDEO_PROCESSING_URL,
        "Could not start video processing"
    );
    return processing;
}

/** The user's videos whose processing failed, with the error each failed with */
export async function getFailedVideos() {
    const { videos } = await request<{ videos: FailedVideo[] }>(
        "GET",
        FAILED_VIDEOS_URL,
        "Could not load the failed videos"
    );
    return videos;
}

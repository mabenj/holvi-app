import useSWR from "swr";
import {
    getVideoProcessingStatus,
    VIDEO_PROCESSING_URL
} from "../client/video-processing";
import {
    isVideoProcessingActive,
    VideoProcessingStatus
} from "../types/video-processing-status";

const POLL_INTERVAL_MS = 2_000;

/** The user's video processing status. Polls while videos are pending or processing. */
export function useVideoProcessing() {
    const { data, error, isLoading, mutate } = useSWR(
        VIDEO_PROCESSING_URL,
        getVideoProcessingStatus,
        {
            refreshInterval: (latest) =>
                latest && isVideoProcessingActive(latest) ? POLL_INTERVAL_MS : 0
        }
    );
    return {
        status: data,
        error: error as Error | undefined,
        isLoading,
        /** Shows a status the server just returned, then keeps polling from it */
        update: (status: VideoProcessingStatus) =>
            mutate(status, { revalidate: false })
    };
}

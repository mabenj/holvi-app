/** How far video processing has got with one user's videos */
export interface VideoProcessingStatus {
    pending: number;
    processing: number;
    done: number;
    failed: number;
    /** The user's video the worker is processing now, if any */
    currentFile: { id: string; collectionId: string; name: string } | null;
}

/** Whether any of the user's videos are pending or processing */
export function isVideoProcessingActive(status: VideoProcessingStatus) {
    return status.pending > 0 || status.processing > 0;
}

/** A video whose processing failed; it still plays from its original */
export interface FailedVideo {
    id: string;
    collectionId: string;
    name: string;
    error: string | null;
}

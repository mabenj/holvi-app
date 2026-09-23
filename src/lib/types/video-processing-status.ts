/** How far video processing has got with one user's videos */
export interface VideoProcessingStatus {
    pending: number;
    processing: number;
    done: number;
    failed: number;
    /** The user's video the worker is processing now, if any */
    currentFile: { id: string; collectionId: string; name: string } | null;
}

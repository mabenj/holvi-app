/** Where a Backup job or a Restore job is in its run */
export type JobStatus =
    | "queued"
    | "running"
    | "completed"
    | "completedWithErrors"
    | "failed"
    | "cancelled";

/** Whether a job with this status is still waiting or running */
export function isActiveJobStatus(status: JobStatus) {
    return status === "queued" || status === "running";
}

/** Whether a job with this status completed, with or without errors */
export function isCompletedJobStatus(status: JobStatus) {
    return status === "completed" || status === "completedWithErrors";
}

/** How far a Backup job or a Restore job has got */
export interface JobProgress {
    collectionsDone: number;
    collectionsTotal: number;
    filesDone: number;
    filesTotal: number;
    bytesDone: number;
    bytesTotal: number;
    currentFileName: string | null;
}

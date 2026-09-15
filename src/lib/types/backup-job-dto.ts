export type BackupJobStatus =
    | "queued"
    | "running"
    | "completed"
    | "completedWithErrors"
    | "failed"
    | "cancelled";

/** Whether a backup job with this status is still waiting or running */
export function isActiveBackupJobStatus(status: BackupJobStatus) {
    return status === "queued" || status === "running";
}

export interface BackupJobDto {
    id: string;
    status: BackupJobStatus;
    queuedAt: number;
    startedAt: number | null;
    finishedAt: number | null;
    progress: {
        collectionsDone: number;
        collectionsTotal: number;
        filesDone: number;
        filesTotal: number;
        bytesDone: number;
        bytesTotal: number;
        currentFileName: string | null;
    };
    zipFileName: string | null;
    zipSizeBytes: number | null;
    errorMessage: string | null;
}

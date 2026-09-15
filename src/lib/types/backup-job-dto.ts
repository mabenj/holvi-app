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

/** Whether a backup job with this status left a backup behind */
export function isCompletedBackupJobStatus(status: BackupJobStatus) {
    return status === "completed" || status === "completedWithErrors";
}

/** A file that a backup could not include whole: a Skipped file or a Damaged file */
export interface BackupProblem {
    fileId: string;
    collectionId: string;
    /** The file's original name */
    name: string;
    kind: "skipped" | "damaged";
    reason: string;
    /** Only for damaged files */
    bytesWritten: number | null;
    /** Only for damaged files */
    bytesExpected: number | null;
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
    skippedCount: number;
    damagedCount: number;
    problems: BackupProblem[];
    errorMessage: string | null;
}

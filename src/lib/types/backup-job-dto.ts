import { isCompletedJobStatus, JobProgress, JobStatus } from "./job-dto";

/**
 * Whether this job's backup is the user's Current backup: the one still on the
 * server, and so the only one that can be downloaded or deleted. Only a
 * completed backup job leaves a backup behind.
 */
export function isCurrentBackup(job: BackupJobDto) {
    return isCompletedJobStatus(job.status) && job.zipFileName !== null;
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
    status: JobStatus;
    queuedAt: number;
    startedAt: number | null;
    finishedAt: number | null;
    progress: JobProgress;
    zipFileName: string | null;
    zipSizeBytes: number | null;
    skippedCount: number;
    damagedCount: number;
    problems: BackupProblem[];
    errorMessage: string | null;
}

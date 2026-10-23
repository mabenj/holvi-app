import { BackupProblem } from "./backup-job-dto";

export type RestoreJobStatus =
    | "queued"
    | "running"
    | "completed"
    | "completedWithErrors"
    | "failed"
    | "cancelled";

/** Whether a Restore job with this status is still waiting or running */
export function isActiveRestoreJobStatus(status: RestoreJobStatus) {
    return status === "queued" || status === "running";
}

/** A file of a Backup whose content did not match its metadata, so the Restore job left it out */
export interface UnrestoredFile {
    fileId: string;
    collectionId: string;
    /** The file's original name */
    name: string;
    reason: string;
}

export interface RestoreJobDto {
    id: string;
    status: RestoreJobStatus;
    /** The source it restores from, as listed by the user's restore sources */
    sourceId: string;
    /** The zip's file name */
    sourceName: string;
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
    unrestoredFiles: UnrestoredFile[];
    /** The Backup's own Problem files, which it holds no whole copy of */
    problems: BackupProblem[];
    errorMessage: string | null;
}

/** A Backup the user can restore from */
export interface RestoreSourceDto {
    /** Opaque: "current" for the Current backup, otherwise the zip's name in the user's folder */
    id: string;
    kind: "current" | "placed";
    fileName: string;
    sizeBytes: number;
    /** When the Backup was taken, from its Manifest; null if it cannot be read */
    takenAt: number | null;
}

export interface RestoreSources {
    sources: RestoreSourceDto[];
    /** The name of the user's folder in the restore directory, where the operator places their Backups */
    folderName: string;
    /** Set when the folder does not exist yet, saying what to ask the operator for */
    hint: string | null;
    /** Why no source can be restored right now, such as the account having collections */
    unavailableReason: string | null;
}

/** What a Backup's Manifest says it holds */
export interface RestoreSummary {
    username: string;
    takenAt: number;
    formatVersion: number;
    collectionCount: number;
    /** Files the Backup holds whole, which a Restore brings back */
    fileCount: number;
    /** Their total size */
    bytes: number;
    zipSizeBytes: number;
    problems: BackupProblem[];
}

/** A source's summary if it can be restored, otherwise why not */
export interface RestoreInspection {
    source: RestoreSourceDto;
    summary: RestoreSummary | null;
    reason: string | null;
}

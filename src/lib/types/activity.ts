import { BackupJobDto } from "./backup-job-dto";
import { VideoProcessingStatus } from "./video-processing-status";

/** The background work Holvi is doing for one user */
export interface Activity {
    /** The user's queued or running Backup job, if any */
    backupJob: BackupJobDto | null;
    videoProcessing: VideoProcessingStatus;
    /** Whether a Backup job is queued or running, or videos are pending or processing */
    active: boolean;
}

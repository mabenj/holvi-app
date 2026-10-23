import { BackupJobDto } from "./backup-job-dto";
import { VideoProcessingStatus } from "./video-processing-status";

/** The background work Holvi is doing for one user */
export interface Activity {
    /** The user's queued or running Backup job, if any */
    backupJob: BackupJobDto | null;
    videoProcessing: VideoProcessingStatus;
    /** How many of the user's files are waiting for their thumbnail; failed thumbnails are not counted */
    pendingThumbnails: number;
    /** Whether a Backup job is queued or running, videos are pending or processing, or thumbnails are pending */
    active: boolean;
}

import { Activity } from "../types/activity";
import { isVideoProcessingActive } from "../types/video-processing-status";
import { BackupService } from "./backup.service";
import { ThumbnailService } from "./thumbnail.service";
import { VideoProcessingService } from "./video-processing.service";

export type { Activity } from "../types/activity";

/** The background work Holvi is doing for one user: their Backup job, their video processing and their pending thumbnails */
export class ActivityService {
    constructor(private readonly userId: string) {}

    async getActivity(): Promise<Activity> {
        const [backupJob, videoProcessing, thumbnails] = await Promise.all([
            new BackupService(this.userId).getActiveJob(),
            new VideoProcessingService(this.userId).getStatus(),
            new ThumbnailService(this.userId).getStatus()
        ]);
        return {
            backupJob,
            videoProcessing,
            pendingThumbnails: thumbnails.pending,
            active:
                backupJob !== null ||
                isVideoProcessingActive(videoProcessing) ||
                thumbnails.pending > 0
        };
    }
}

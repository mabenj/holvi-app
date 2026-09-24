import { Activity } from "../types/activity";
import { isVideoProcessingActive } from "../types/video-processing-status";
import { BackupService } from "./backup.service";
import { VideoProcessingService } from "./video-processing.service";

export type { Activity } from "../types/activity";

/** The background work Holvi is doing for one user: their Backup job and their video processing */
export class ActivityService {
    constructor(private readonly userId: string) {}

    async getActivity(): Promise<Activity> {
        const [backupJob, videoProcessing] = await Promise.all([
            new BackupService(this.userId).getActiveJob(),
            new VideoProcessingService(this.userId).getStatus()
        ]);
        return {
            backupJob,
            videoProcessing,
            active: backupJob !== null || isVideoProcessingActive(videoProcessing)
        };
    }
}

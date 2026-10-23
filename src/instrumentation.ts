/** Called by Next.js once when the server starts */
export async function register() {
    // Also called for the edge runtime, which cannot run backups, restores,
    // video processing or thumbnails. The imports must stay inside this exact check so they are
    // left out of the edge bundle.
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { BackupService } = await import("./lib/services/backup.service");
        // Failures are logged by the service; the app still serves without backups
        await BackupService.recover().catch(() => {});
        const { RestoreService } = await import(
            "./lib/services/restore.service"
        );
        // Continues Restore jobs left running where they left off, then runs
        // queued ones. Failures are logged by the service.
        await RestoreService.recover().catch(() => {});
        const { VideoProcessingService } = await import(
            "./lib/services/video-processing.service"
        );
        // Resumes videos left pending or processing, such as uploads just
        // before a restart. Failures are logged by the service.
        await VideoProcessingService.recover().catch(() => {});
        const { ThumbnailService } = await import(
            "./lib/services/thumbnail.service"
        );
        // Resumes pending thumbnails. Failures are logged by the service.
        await ThumbnailService.recover().catch(() => {});
    }
}

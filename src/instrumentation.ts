/** Called by Next.js once when the server starts */
export async function register() {
    // Also called for the edge runtime, which cannot run backups or video
    // processing. The imports must stay inside this exact check so they are
    // left out of the edge bundle.
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { BackupService } = await import("./lib/services/backup.service");
        // Failures are logged by the service; the app still serves without backups
        await BackupService.recover().catch(() => {});
        const { VideoProcessingService } = await import(
            "./lib/services/video-processing.service"
        );
        // Resumes videos left pending or processing, such as uploads just
        // before a restart. Failures are logged by the service.
        await VideoProcessingService.recover().catch(() => {});
    }
}

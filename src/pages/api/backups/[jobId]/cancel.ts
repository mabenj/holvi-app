import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { BackupService } from "@/lib/services/backup.service";
import { BackupJobDto } from "@/lib/types/backup-job-dto";

async function cancelJob(
    req: ApiRequest,
    res: ApiResponse<{ job?: BackupJobDto }>
) {
    const { jobId } = req.query as { jobId: string };
    const service = new BackupService(req.session.user.id);
    const job = await service.cancel(jobId);
    res.status(200).json({ status: "ok", job });
}

export default ApiRoute.create({
    post: cancelJob
});

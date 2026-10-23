import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { RestoreService } from "@/lib/services/restore.service";
import { RestoreJobDto } from "@/lib/types/restore-job-dto";

async function cancelJob(
    req: ApiRequest,
    res: ApiResponse<{ job?: RestoreJobDto }>
) {
    const { jobId } = req.query as { jobId: string };
    const service = new RestoreService(req.session.user.id);
    const job = await service.cancel(jobId);
    res.status(200).json({ status: "ok", job });
}

export default ApiRoute.create({
    post: cancelJob
});

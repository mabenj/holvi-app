import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { RestoreService } from "@/lib/services/restore.service";
import { RestoreJobDto } from "@/lib/types/restore-job-dto";
import { StartRestoreValidator } from "@/lib/validators/restore.validator";

async function getJobs(
    req: ApiRequest,
    res: ApiResponse<{ jobs?: RestoreJobDto[] }>
) {
    const service = new RestoreService(req.session.user.id);
    const jobs = await service.getJobs();
    res.status(200).json({ status: "ok", jobs });
}

async function startRestore(
    req: ApiRequest,
    res: ApiResponse<{ job?: RestoreJobDto }>
) {
    const { sourceId } = req.body as { sourceId: string };
    const service = new RestoreService(req.session.user.id);
    const job = await service.start(sourceId);
    res.status(202).json({ status: "ok", job });
}

export default ApiRoute.create({
    get: getJobs,
    post: { handler: startRestore, validator: StartRestoreValidator }
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { BackupService } from "@/lib/services/backup.service";
import { BackupJobDto } from "@/lib/types/backup-job-dto";

async function getJobs(
    req: ApiRequest,
    res: ApiResponse<{ jobs?: BackupJobDto[] }>
) {
    const service = new BackupService(req.session.user.id);
    const jobs = await service.getJobs();
    res.status(200).json({ status: "ok", jobs });
}

async function startBackup(
    req: ApiRequest,
    res: ApiResponse<{ job?: BackupJobDto }>
) {
    const service = new BackupService(req.session.user.id);
    const job = await service.start();
    res.status(202).json({ status: "ok", job });
}

export default ApiRoute.create({
    get: getJobs,
    post: startBackup
});

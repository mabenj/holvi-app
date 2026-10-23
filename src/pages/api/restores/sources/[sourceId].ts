import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { RestoreService } from "@/lib/services/restore.service";
import { RestoreInspection } from "@/lib/types/restore-job-dto";

async function inspectSource(
    req: ApiRequest,
    res: ApiResponse<{ inspection?: RestoreInspection }>
) {
    const { sourceId } = req.query as { sourceId: string };
    const service = new RestoreService(req.session.user.id);
    const inspection = await service.inspect(sourceId);
    res.status(200).json({ status: "ok", inspection });
}

export default ApiRoute.create({
    get: inspectSource
});

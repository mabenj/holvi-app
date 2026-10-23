import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { RestoreService } from "@/lib/services/restore.service";
import { RestoreSources } from "@/lib/types/restore-job-dto";

async function listSources(
    req: ApiRequest,
    res: ApiResponse<Partial<RestoreSources>>
) {
    const service = new RestoreService(req.session.user.id);
    const sources = await service.listSources();
    res.status(200).json({ status: "ok", ...sources });
}

export default ApiRoute.create({
    get: listSources
});

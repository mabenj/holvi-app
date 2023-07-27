import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import TagService from "@/lib/services/tag.service";

async function getTags(req: ApiRequest, res: ApiResponse<{ tags: string[] }>) {
    const service = new TagService(req.session.user.id);
    const tags = await service.getTags();
    res.status(200).json({ status: "ok", tags });
}

export default ApiRoute.create({ get: getTags });

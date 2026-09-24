import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { singleQueryParam } from "@/lib/common/query-params";
import TagService from "@/lib/services/tag.service";

/** Tag autocomplete for tag inputs: the user's tags that contain ?query= */
async function suggestTags(
    req: ApiRequest,
    res: ApiResponse<{ tags: string[] }>
) {
    const service = new TagService(req.session.user.id);
    const tags = await service.suggestTags(
        singleQueryParam(req.query.query) ?? ""
    );
    res.status(200).json({ status: "ok", tags });
}

export default ApiRoute.create({ get: suggestTags });

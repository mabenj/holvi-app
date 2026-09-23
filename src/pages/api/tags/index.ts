import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { singleQueryParam } from "@/lib/common/query-params";
import TagService, { TagCount, TagScope } from "@/lib/services/tag.service";

/** The user's tags with their counts: ?scope=collections|files&collectionId= */
async function countTags(
    req: ApiRequest,
    res: ApiResponse<{ tags: TagCount[] }>
) {
    const service = new TagService(req.session.user.id);
    const tags = await service.countTags({
        // The service rejects any scope it does not know
        scope: singleQueryParam(req.query.scope) as TagScope,
        collectionId: singleQueryParam(req.query.collectionId)
    });
    res.status(200).json({ status: "ok", tags });
}

export default ApiRoute.create({ get: countTags });

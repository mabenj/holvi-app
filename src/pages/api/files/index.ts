import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import {
    listQueryParam,
    numberQueryParam,
    singleQueryParam
} from "@/lib/common/query-params";
import {
    BrowseFilesPage,
    CollectionService
} from "@/lib/services/collection.service";

/**
 * One page of the Timeline, newest first: ?tags=&tags=&cursor=&limit=. A file
 * has a tag if it or its collection has it.
 */
async function get(
    req: ApiRequest,
    res: ApiResponse<Partial<BrowseFilesPage>>
) {
    const service = new CollectionService(req.session.user.id);
    const page = await service.browseTimeline({
        tags: listQueryParam(req.query.tags),
        cursor: singleQueryParam(req.query.cursor),
        limit: numberQueryParam(req.query.limit)
    });
    res.status(200).json({ status: "ok", ...page });
}

export default ApiRoute.create({ get });

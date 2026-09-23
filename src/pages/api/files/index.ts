import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { numberQueryParam, singleQueryParam } from "@/lib/common/query-params";
import {
    BrowseFilesPage,
    CollectionService
} from "@/lib/services/collection.service";

/** One page of the Timeline, newest first: ?cursor=&limit= */
async function get(
    req: ApiRequest,
    res: ApiResponse<Partial<BrowseFilesPage>>
) {
    const service = new CollectionService(req.session.user.id);
    const page = await service.browseTimeline({
        cursor: singleQueryParam(req.query.cursor),
        limit: numberQueryParam(req.query.limit)
    });
    res.status(200).json({ status: "ok", ...page });
}

export default ApiRoute.create({ get });

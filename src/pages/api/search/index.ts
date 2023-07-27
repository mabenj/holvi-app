import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import SearchService from "@/lib/services/search.service";
import { SearchResult } from "@/lib/types/search-result";

async function search(req: ApiRequest, res: ApiResponse<SearchResult>) {
    let { query, tags } = req.query as { query?: string; tags?: string };
    query = query ? decodeURIComponent(query) : "";
    const tagList = tags ? decodeURIComponent(tags).split(",") : [];

    const service = new SearchService(req.session.user.id);
    const { collections, files } = await service.search(query, tagList);
    res.status(200).json({ status: "ok", collections, files });
}

export default ApiRoute.create({ get: search });

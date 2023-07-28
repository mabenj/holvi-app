import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import SearchService from "@/lib/services/search.service";
import { SearchResult } from "@/lib/types/search-result";
import { SearchRequest, SearchRequestValidator } from "@/lib/validators/search-request.validator";

async function search(req: ApiRequest<SearchRequest>, res: ApiResponse<SearchResult>) {
    const service = new SearchService(req.session.user.id);
    const { collections, files } = await service.search(req.body);
    res.status(200).json({ status: "ok", collections, files });
}

export default ApiRoute.create({ post: {
    handler: search,
    validator: SearchRequestValidator
} });

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import SearchService from "@/lib/services/search.service";

async function tagAutocomplete(
    req: ApiRequest,
    res: ApiResponse<{ tags: string[] }>
) {
    const { query } = req.query as { query: string };
    const service = new SearchService(req.session.user.id);
    const tags = await service.tagAutocomplete(query);
    res.status(200).json({ status: "ok", tags });
}

export default ApiRoute.create({ get: tagAutocomplete });

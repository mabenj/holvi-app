import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";

async function getAllFiles(
    req: ApiRequest,
    res: ApiResponse<{ files: CollectionFileDto[] }>
) {
    const service = new CollectionService(req.session.user.id);
    const files = await service.getAllFiles();
    res.status(200).json({ status: "ok", files });
}

export default ApiRoute.create({ get: getAllFiles });

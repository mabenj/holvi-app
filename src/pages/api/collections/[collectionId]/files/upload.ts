import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";

async function uploadFiles(
    req: ApiRequest,
    res: ApiResponse<{
        collection?: CollectionDto,
        files?: CollectionFileDto[];
        errors?: string[];
    }>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, files, errors } = await collectionService.uploadFiles(
        collectionId,
        req
    );
    res.status(201).json({ status: "ok", collection, files, errors });
}

export const config = {
    api: {
        bodyParser: false
    }
};

export default ApiRoute.create({ post: uploadFiles });

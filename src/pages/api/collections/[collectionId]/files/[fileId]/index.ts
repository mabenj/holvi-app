import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";

async function deleteFile(req: ApiRequest, res: ApiResponse) {
    const { collectionId, fileId } = req.query as {
        collectionId: string;
        fileId: string;
    };
    const collectionService = new CollectionService(req.session.user.id);
    await collectionService.deleteFile(collectionId, fileId);
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({ delete: deleteFile });

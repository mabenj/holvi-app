import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { GetCollectionResponse } from "@/lib/interfaces/get-collection-response";
import { CollectionService } from "@/lib/services/collection.service";

async function getCollection(
    req: ApiRequest,
    res: ApiResponse<GetCollectionResponse>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const collection = await collectionService.getCollection(collectionId);
    res.status(200).json({ status: "ok", collection });
}

async function deleteCollection(req: ApiRequest, res: ApiResponse) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    await collectionService.deleteCollection(collectionId);
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    get: getCollection,
    delete: deleteCollection
});

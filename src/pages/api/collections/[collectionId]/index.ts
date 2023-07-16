import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { GetCollectionResponse } from "@/lib/interfaces/get-collection-response";
import { CollectionService } from "@/lib/services/collection.service";

async function getCollection(
    req: ApiRequest,
    res: ApiResponse<GetCollectionResponse>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, notFound } = await collectionService.get(collectionId);
    if (!collection || notFound) {
        res.status(404).json({ status: "error", error: "Not found" });
        return;
    }
    res.status(200).json({ status: "ok", collection });
}

async function deleteCollection(req: ApiRequest, res: ApiResponse) {
    const { collectionId } = req.query;
    const collectionService = new CollectionService(req.session.user.id);
    const { error } = await collectionService.delete(
        collectionId?.toString() || ""
    );
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    get: {
        handler: getCollection
    },
    delete: {
        handler: deleteCollection
    }
});

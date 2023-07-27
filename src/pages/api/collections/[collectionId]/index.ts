import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import { GetCollectionResponse } from "@/lib/types/get-collection-response";
import {
    CollectionFormData,
    CollectionValidator
} from "@/lib/validators/collection-validator";

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

async function updateCollection(
    req: ApiRequest<CollectionFormData>,
    res: ApiResponse<{ collection?: CollectionDto; nameError?: string }>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const { collection: updated, nameError } =
        await collectionService.updateCollection(collectionId, req.body);
    if (nameError) {
        res.status(400).json({ status: "error", error: nameError, nameError });
    }
    res.status(200).json({ status: "ok", collection: updated });
}

export default ApiRoute.create({
    get: getCollection,
    delete: deleteCollection,
    post: {
        handler: updateCollection,
        validator: CollectionValidator
    }
});

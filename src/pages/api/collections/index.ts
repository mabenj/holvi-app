import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import {
    CollectionFormData,
    CollectionValidator
} from "@/lib/validators/collection.validator";

async function getCollections(
    req: ApiRequest,
    res: ApiResponse<{
        collections?: CollectionDto[];
    }>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const collections = await collectionService.getAllCollections();
    res.status(200).json({ status: "ok", collections });
}

async function createCollection(
    req: ApiRequest<CollectionFormData>,
    res: ApiResponse<{ collection?: CollectionDto; nameError?: string }>
) {
    const { name, tags, description } = req.body;
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, nameError } = await collectionService.createCollection(
        name,
        tags,
        description
    );
    if (!collection || nameError) {
        res.status(400).json({
            status: "error",
            error: nameError || "Error creating collection",
            nameError
        });
        return;
    }

    res.status(201).json({ status: "ok", collection });
}

export default ApiRoute.create({
    get: getCollections,
    post: {
        handler: createCollection,
        validator: CollectionValidator
    }
});

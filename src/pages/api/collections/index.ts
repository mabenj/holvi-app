import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CreateCollectionResponse } from "@/lib/interfaces/create-collection-response";
import { GetCollectionsResponse } from "@/lib/interfaces/get-collections-results";
import { UpdateCollectionResponse } from "@/lib/interfaces/update-collection-result";
import { CollectionService } from "@/lib/services/collection.service";
import {
    CreateCollectionFormData,
    CreateCollectionValidator
} from "@/lib/validators/create-collection-validator";
import {
    UpdateCollectionData,
    UpdateCollectionValidator
} from "@/lib/validators/update-collection-validator";

async function getCollections(
    req: ApiRequest,
    res: ApiResponse<GetCollectionsResponse>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const collections = await collectionService.getAll();
    res.status(200).json({ status: "ok", collections });
}

async function updateCollection(
    req: ApiRequest<UpdateCollectionData>,
    res: ApiResponse<UpdateCollectionResponse>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const { collection: updated, error } = await collectionService.update(
        req.body
    );
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(200).json({ status: "ok", collection: updated });
}

async function createCollection(
    req: ApiRequest<CreateCollectionFormData>,
    res: ApiResponse<CreateCollectionResponse>
) {
    const { name, tags } = req.body;
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, error } = await collectionService.create(name, tags);
    if (!collection || error) {
        res.status(400).json({
            status: "error",
            error: error || "Error creating collection"
        });
        return;
    }

    res.status(201).json({ status: "ok", collection });
}

export default ApiRoute.create({
    get: {
        handler: getCollections
    },
    post: {
        handler: createCollection,
        validator: CreateCollectionValidator
    },
    put: {
        handler: updateCollection,
        validator: UpdateCollectionValidator
    }
});

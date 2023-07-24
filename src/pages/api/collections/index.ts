import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { CreateCollectionResponse } from "@/lib/types/create-collection-response";
import { GetCollectionsResponse } from "@/lib/types/get-collections-results";
import { UpdateCollectionResponse } from "@/lib/types/update-collection-result";
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
    const collections = await collectionService.getAllCollections();
    res.status(200).json({ status: "ok", collections });
}

async function updateCollection(
    req: ApiRequest<UpdateCollectionData>,
    res: ApiResponse<UpdateCollectionResponse>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const { collection: updated, nameError } =
        await collectionService.updateCollection(req.body);
    if (nameError) {
        res.status(400).json({ status: "error", error: nameError, nameError });
    }
    res.status(200).json({ status: "ok", collection: updated });
}

async function createCollection(
    req: ApiRequest<CreateCollectionFormData>,
    res: ApiResponse<CreateCollectionResponse>
) {
    const { name, tags } = req.body;
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, nameError } = await collectionService.createCollection(
        name,
        tags
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
        validator: CreateCollectionValidator
    },
    put: {
        handler: updateCollection,
        validator: UpdateCollectionValidator
    }
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { InvalidArgumentError } from "@/lib/common/errors";
import { CollectionSort } from "@/lib/services/collection-browsing";
import {
    BrowseCollectionsPage,
    CollectionService
} from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import {
    CollectionFormData,
    CollectionValidator
} from "@/lib/validators/collection.validator";

/** One page of the user's collections: ?sort=random&seed=&cursor=&limit= */
async function browseCollections(
    req: ApiRequest,
    res: ApiResponse<Partial<BrowseCollectionsPage>>
) {
    const limit = single(req.query.limit);
    const collectionService = new CollectionService(req.session.user.id);
    const page = await collectionService.browseCollections({
        // The service rejects any sort it does not know
        sort: single(req.query.sort) as CollectionSort | undefined,
        seed: single(req.query.seed),
        cursor: single(req.query.cursor),
        limit: limit === undefined ? undefined : Number(limit)
    });
    res.status(200).json({ status: "ok", ...page });
}

function single(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        throw new InvalidArgumentError("Repeated query parameter");
    }
    return value || undefined;
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
    get: browseCollections,
    post: {
        handler: createCollection,
        validator: CollectionValidator
    }
});

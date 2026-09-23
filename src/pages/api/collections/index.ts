import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import {
    booleanQueryParam,
    listQueryParam,
    numberQueryParam,
    singleQueryParam
} from "@/lib/common/query-params";
import { CollectionSort } from "@/lib/services/collection-browsing";
import {
    BrowseCollectionsPage,
    CollectionFileType,
    CollectionService
} from "@/lib/services/collection.service";
import { CollectionDto } from "@/lib/types/collection-dto";
import {
    CollectionFormData,
    CollectionValidator
} from "@/lib/validators/collection.validator";

/**
 * One page of the user's collections:
 * ?sort=&tags=&tags=&fileType=&forgotten=&q=&seed=&cursor=&limit=
 */
async function browseCollections(
    req: ApiRequest,
    res: ApiResponse<Partial<BrowseCollectionsPage>>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const page = await collectionService.browseCollections({
        // The service rejects any sort or file type it does not know
        sort: singleQueryParam(req.query.sort) as CollectionSort | undefined,
        tags: listQueryParam(req.query.tags),
        fileType: singleQueryParam(req.query.fileType) as
            | CollectionFileType
            | undefined,
        forgotten: booleanQueryParam(req.query.forgotten),
        q: singleQueryParam(req.query.q),
        seed: singleQueryParam(req.query.seed),
        cursor: singleQueryParam(req.query.cursor),
        limit: numberQueryParam(req.query.limit)
    });
    res.status(200).json({ status: "ok", ...page });
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

import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetAllResult {
    collections?: CollectionDto[];
}

interface UpdateResult {
    collection?: CollectionDto;
}

interface CreateResult {
    collection?: CollectionDto;
}

async function getCollections(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetAllResult>>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const collections = await collectionService.getAll();
    res.status(200).json({ status: "ok", collections });
}

async function updateCollection(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<UpdateResult>>
) {
    const collection = JSON.parse(req.body) as CollectionDto;
    const collectionService = new CollectionService(req.session.user.id);
    const { collection: updated, error } = await collectionService.update(
        collection
    );
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(200).json({ status: "ok", collection: updated });
}

async function createCollection(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<CreateResult>>
) {
    const { name, tags } = JSON.parse(req.body);
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
    get: getCollections,
    post: createCollection,
    put: updateCollection
});

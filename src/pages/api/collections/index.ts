import { ApiRoute } from "@/lib/common/api-route";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetCollectionsResponse {
    status: "ok" | "error";
    error?: string;
    collections?: Collection[];
}

interface UpdateCollectionResponse {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
}

interface CreateCollectionResponse {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
}

async function getCollections(
    req: NextApiRequest,
    res: NextApiResponse<GetCollectionsResponse>
) {
    const collectionService = new CollectionService(req.session.user.id);
    const collections = await collectionService.getAll();
    res.status(200).json({ status: "ok", collections });
}

async function updateCollection(
    req: NextApiRequest,
    res: NextApiResponse<UpdateCollectionResponse>
) {
    const collection = JSON.parse(req.body) as Collection;
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
    res: NextApiResponse<CreateCollectionResponse>
) {
    const { name, tags } = JSON.parse(req.body);
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, error } = await collectionService.create(name, tags);
    if (!collection || error) {
        res.status(400).json({ status: "error", error });
        return;
    }

    res.status(201).json({ status: "ok", collection });
}

export default ApiRoute.create({
    get: getCollections,
    post: createCollection,
    put: updateCollection
});

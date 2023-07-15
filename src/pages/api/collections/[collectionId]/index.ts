import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetResult {
    collection?: CollectionDto;
}

async function getCollection(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetResult>>
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

async function deleteCollection(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
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
    get: getCollection,
    delete: deleteCollection
});

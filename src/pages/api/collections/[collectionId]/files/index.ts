import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetResult {
    collection?: CollectionDto;
    files?: CollectionFileDto[];
}

async function getCollectionFiles(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetResult>>
) {
    const { collectionId } = req.query;
    const service = new CollectionService(req.session.user.id);
    const { notFound, collection, files } = await service.getCollectionFiles(
        collectionId?.toString() || ""
    );
    if (notFound || !collection) {
        res.status(404).json({ status: "error" });
        return;
    }
    res.status(200).json({ status: "ok", collection, files });
}

export default ApiRoute.create({ get: getCollectionFiles });

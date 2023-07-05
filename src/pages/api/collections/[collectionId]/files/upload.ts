import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionFile } from "@/lib/interfaces/collection-file";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface Result {
    files?: CollectionFile[];
}

async function uploadFiles(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<Result>>
) {
    const { collectionId } = req.query;
    const collectionService = new CollectionService(req.session.user.id);
    const { error, files } = await collectionService.uploadFiles(
        collectionId?.toString() || "",
        req
    );
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(201).json({ status: "ok", files });
}

export const config = {
    api: {
        bodyParser: false
    }
};

export default ApiRoute.create({ put: uploadFiles });

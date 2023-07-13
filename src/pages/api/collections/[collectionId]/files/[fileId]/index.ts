import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

async function deleteFile(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    const { collectionId, fileId } = req.query as {collectionId: string, fileId: string};
    const collectionService = new CollectionService(req.session.user.id);
    const { error } = await collectionService.deleteFile(collectionId, fileId)
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({ delete: deleteFile });

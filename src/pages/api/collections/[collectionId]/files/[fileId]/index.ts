import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

async function deleteFile(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    // const { collectionId } = req.query;
    // const collectionService = new CollectionService(req.session.user.id);
    // const { error, files } = await collectionService.uploadFiles(
    //     parseInt(collectionId?.toString() || ""),
    //     req
    // );
    // if (error) {
    //     res.status(400).json({ status: "error", error });
    //     return;
    // }
    // res.status(201).json({ status: "ok", files });
    res.status(501).end();
}

export default ApiRoute.create({ delete: deleteFile });

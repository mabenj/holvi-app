import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetResult {}

async function getFile(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetResult>>
) {
    const { collectionId, fileId } = req.query;
    const collectionService = new CollectionService(req.session.user.id);
    const { file, mimeType, notFound } = await collectionService.getFile(
        collectionId?.toString() || "",
        fileId?.toString() || ""
    );
    if (!file || !mimeType || notFound) {
        res.status(404).json({ status: "error" });
        return;
    }
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).end(file);
}

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

export const config = {
    api: {
        responseLimit: false
    }
};

export default ApiRoute.create({ get: getFile, delete: deleteFile });

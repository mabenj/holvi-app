import { ApiRoute } from "@/lib/common/api-route";
import type { NextApiRequest, NextApiResponse } from "next";

interface ResponseData {
    status: "ok" | "error";
    error?: string;
}

async function getFile(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
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

async function deleteFile(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
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

export default ApiRoute.create({ get: getFile, delete: deleteFile });

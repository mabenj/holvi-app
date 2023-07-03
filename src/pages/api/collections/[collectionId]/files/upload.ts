import { ApiRoute } from "@/lib/common/api-route";
import { CollectionFile } from "@/lib/interfaces/collection-file";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    files?: CollectionFile[];
};

export default ApiRoute.create({ put });

async function put(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    const { collectionId } = req.query;
    const collectionService = new CollectionService(req.session.user.id);
    const { error, files } = await collectionService.uploadFiles(
        parseInt(collectionId?.toString() || ""),
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

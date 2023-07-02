import { ApiRoute } from "@/lib/common/api-route";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
};

export default ApiRoute.post(handler);

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const { name, tags } = JSON.parse(req.body);
        const collectionService = new CollectionService(req.session.user.id);
        const { collection, error } = await collectionService.create(
            name,
            tags
        );
        if (!collection || error) {
            res.status(400).json({ status: "error", error });
            return;
        }

        res.status(201).json({ status: "ok", collection });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

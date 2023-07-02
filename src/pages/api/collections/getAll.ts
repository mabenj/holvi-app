import { ApiRoute } from "@/lib/common/api-route";
import { withUser } from "@/lib/common/route-helpers";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collections?: Collection[];
};

export default ApiRoute.get(handler);

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const collectionService = new CollectionService(req.session.user.id);
        const collections = await collectionService.getAll();
        res.status(200).json({ status: "ok", collections });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

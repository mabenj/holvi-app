import { withGet, withUser } from "@/lib/common/api-route-helpers";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
    files?: any[];
};

export default withGet(withUser(handler));

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const { collectionId } = req.query;
        const collectionService = new CollectionService(req.session.user.id);
        const { notFound, collection, files } = await collectionService.get(
            parseInt(collectionId?.toString() || "")
        );
        if (notFound || !collection) {
            res.status(404);
            return;
        }
        res.status(200).json({ status: "ok", collection, files });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

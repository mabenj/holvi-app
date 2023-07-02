import { withPost, withUser } from "@/lib/common/route-helpers";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
};

export default withPost(withUser(handler));

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const collection = JSON.parse(req.body) as Collection;
        const collectionService = new CollectionService(req.session.user.id);
        const { collection: updated, error } = await collectionService.update(
            collection
        );
        if (error) {
            res.status(400).json({ status: "error", error });
            return;
        }
        res.status(200).json({ status: "ok", collection: updated });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

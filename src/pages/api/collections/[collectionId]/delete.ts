import { ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
};

export default ApiRoute.delete(handler);

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const { collectionId } = req.query;
        const collectionService = new CollectionService(req.session.user.id);
        const { error } = await collectionService.delete(
            parseInt(collectionId?.toString() || "")
        );
        if (error) {
            res.status(400).json({ status: "error", error });
            return;
        }
        res.status(200).json({ status: "ok" });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

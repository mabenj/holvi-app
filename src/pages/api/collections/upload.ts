import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionService } from "@/lib/services/collection.service";
import { NextApiRequest, NextApiResponse } from "next";

interface UploadResult {
    collection?: CollectionDto;
}

async function uploadCollection(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<UploadResult>>
) {
    const { name } = req.query as { name: string };
    if (!name) {
        res.status(400).json({
            status: "error",
            error: "Invalid collection name"
        });
    }
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, error } = await collectionService.uploadCollection(
        name,
        req
    );
    if (!collection || error) {
        res.status(400).json({
            status: "error",
            error: error || "Error uploading collection"
        });
        return;
    }

    res.status(200).json({ status: "ok", collection });
}

export const config = {
    api: {
        bodyParser: false
    }
};

export default ApiRoute.create({
    post: uploadCollection
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { z } from "zod";

/** Makes one of the collection's files its Cover, or null the automatic Cover again */
async function setCover(
    req: ApiRequest<{ fileId: string | null }>,
    res: ApiResponse
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    await collectionService.setCover(collectionId, req.body.fileId);
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    put: {
        handler: setCover,
        // The service checks that the file is in the collection
        validator: z.object({ fileId: z.string().uuid().nullable() })
    }
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";

/** Records a visit to the collection's page: an Open, unless it extends the previous one */
async function recordOpen(req: ApiRequest, res: ApiResponse) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    await collectionService.recordOpen(collectionId);
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    post: recordOpen
});

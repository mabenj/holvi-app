import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import contentDisposition from "content-disposition";

async function backupCollections(req: ApiRequest, res: ApiResponse) {
  const collectionService = new CollectionService(req.session.user.id);
  await collectionService.backupCollections();
  res.status(200).json({ status: "ok" });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ApiRoute.create({
  post: backupCollections,
});

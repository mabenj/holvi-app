import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import contentDisposition from "content-disposition";

async function exportCollections(req: ApiRequest, res: ApiResponse) {
  const collectionService = new CollectionService(req.session.user.id);
  const { stream, filename } = await collectionService.exportCollections();
  if (!stream) {
    res.status(400).json({
      status: "error",
      error: "Error exporting collections",
    });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    contentDisposition(filename, { type: "inline" })
  );
  stream.pipe(res);
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default ApiRoute.create({
  get: exportCollections,
});

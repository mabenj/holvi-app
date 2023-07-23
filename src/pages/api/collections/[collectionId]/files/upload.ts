import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { UploadFilesResponse } from "@/lib/interfaces/upload-files-response";
import { CollectionService } from "@/lib/services/collection.service";

async function uploadFiles(
    req: ApiRequest,
    res: ApiResponse<UploadFilesResponse>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const { files, errors } = await collectionService.uploadFiles(
        collectionId,
        req
    );
    res.status(201).json({ status: "ok", files, errors });
}

export const config = {
    api: {
        bodyParser: false
    }
};

export default ApiRoute.create({ post: uploadFiles });

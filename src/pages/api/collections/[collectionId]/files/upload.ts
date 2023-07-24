import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { UploadFilesResponse } from "@/lib/types/upload-files-response";

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

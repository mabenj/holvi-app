import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { UploadFilesResponse } from "@/lib/interfaces/upload-files-response";
import { CollectionService } from "@/lib/services/collection.service";

async function uploadFiles(
    req: ApiRequest,
    res: ApiResponse<UploadFilesResponse>
) {
    const { collectionId } = req.query as { collectionId: string };
    const collectionService = new CollectionService(req.session.user.id);
    const { error, files } = await collectionService.uploadFiles(
        collectionId,
        req
    );
    if (error) {
        res.status(400).json({ status: "error", error });
        return;
    }
    res.status(201).json({ status: "ok", files });
}

export const config = {
    api: {
        bodyParser: false
    }
};

export default ApiRoute.create({
    post: {
        handler: uploadFiles
    }
});

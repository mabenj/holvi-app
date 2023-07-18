import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { InvalidArgumentError } from "@/lib/common/errors";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionService } from "@/lib/services/collection.service";

interface UploadCollectionResponse {
    collection?: CollectionDto;
}

async function uploadCollection(
    req: ApiRequest,
    res: ApiResponse<UploadCollectionResponse>
) {
    const { name } = req.query as { name: string };
    if (!name) {
        throw new InvalidArgumentError("Invalid collection name");
    }
    const collectionService = new CollectionService(req.session.user.id);
    const { collection, nameError } = await collectionService.uploadCollection(
        name,
        req
    );
    if (!collection || nameError) {
        res.status(400).json({
            status: "error",
            error: nameError || "Error uploading collection"
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

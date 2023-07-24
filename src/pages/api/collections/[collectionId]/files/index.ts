import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { InvalidArgumentError } from "@/lib/common/errors";
import { CollectionService } from "@/lib/services/collection.service";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import { GetCollectionFilesResponse } from "@/lib/types/get-collection-files-response";
import {
    UpdateCollectionFileData,
    UpdateCollectionFileValidator
} from "@/lib/validators/update-collection-file-validator";

async function post(
    req: ApiRequest<UpdateCollectionFileData>,
    res: ApiResponse<{ file?: CollectionFileDto }>
) {
    const { collectionId } = req.query as {
        collectionId: string;
        fileId: string;
    };
    const collectionService = new CollectionService(req.session.user.id);
    const file = await collectionService.updateFile(collectionId, req.body);
    res.status(200).json({ status: "ok", file });
}

async function get(req: ApiRequest, res: ApiResponse) {
    const {
        collectionId,
        video: videoId,
        image: imageId,
        thumbnail: tnFileId
    } = req.query as {
        collectionId: string;
        video: string;
        image: string;
        thumbnail: string;
    };
    if (!videoId && !imageId && !tnFileId) {
        return handleGetCollectionFiles(req, res, collectionId);
    }
    if (tnFileId) {
        return handleGetThumbnail(req, res, collectionId, tnFileId);
    }
    if (imageId) {
        return handleGetCollectionImage(req, res, collectionId, imageId);
    }
    if (videoId) {
        return handleGetCollectionVideo(req, res, collectionId, videoId);
    }
    res.status(404).json({ status: "error", error: "Not found" });
}

async function handleGetCollectionFiles(
    req: ApiRequest,
    res: ApiResponse<GetCollectionFilesResponse>,
    collectionId: string
) {
    const service = new CollectionService(req.session.user.id);
    const files = await service.getFiles(collectionId);
    res.status(200).json({ status: "ok", files });
}

async function handleGetThumbnail(
    req: ApiRequest,
    res: ApiResponse,
    collectionId: string,
    fileId: string
) {
    const service = new CollectionService(req.session.user.id);
    const { file, filename } = await service.getFileBuffer(
        collectionId,
        fileId,
        true
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.setHeader(
        "Content-Disposition",
        `inline; filename="thumbnail_${filename}"`
    );
    res.status(200).end(file);
}

async function handleGetCollectionImage(
    req: ApiRequest,
    res: ApiResponse,
    collectionId: string,
    imageId: string
) {
    const service = new CollectionService(req.session.user.id);
    const { file, mimeType, filename } = await service.getFileBuffer(
        collectionId,
        imageId
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.setHeader("Content-Disposition", `inline; "filename=${filename}"`);
    res.status(200).end(file);
}

async function handleGetCollectionVideo(
    req: ApiRequest,
    res: ApiResponse,
    collectionId: string,
    videoId: string
) {
    const range = req.headers.range;
    if (!range) {
        throw new InvalidArgumentError("Missing range header");
    }
    const chunkStart = Number(range.replace(/\D/g, ""));
    const service = new CollectionService(req.session.user.id);
    const { stream, chunkStartEnd, totalLengthBytes, mimeType, filename } =
        await service.getVideoStream(collectionId, videoId, chunkStart);

    const contentLength = chunkStartEnd[1] - chunkStartEnd[0] + 1;
    res.writeHead(206, {
        "Content-Range": `bytes ${chunkStartEnd[0]}-${chunkStartEnd[1]}/${totalLengthBytes}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": mimeType,
        "Content-Disposition": `inline; "filename=${filename}"`
    });

    stream.pipe(res);
}

export const config = {
    api: {
        responseLimit: false
    }
};

export default ApiRoute.create({
    get,
    post: {
        handler: post,
        validator: UpdateCollectionFileValidator
    }
});

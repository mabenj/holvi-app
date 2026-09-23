import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { InvalidArgumentError } from "@/lib/common/errors";
import {
    listQueryParam,
    numberQueryParam,
    singleQueryParam
} from "@/lib/common/query-params";
import {
    BrowseFilesPage,
    CollectionService,
    FileSort
} from "@/lib/services/collection.service";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import {
    CollectionFileFormData,
    CollectionFileValidator
} from "@/lib/validators/collection-file.validator";
import contentDisposition from "content-disposition";
import { pipeline } from "stream";

async function post(
    req: ApiRequest<CollectionFileFormData>,
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

/** One page of the collection's files: ?sort=newest|oldest|name&tags=&tags=&cursor=&limit= */
async function handleGetCollectionFiles(
    req: ApiRequest,
    res: ApiResponse<Partial<BrowseFilesPage>>,
    collectionId: string
) {
    const service = new CollectionService(req.session.user.id);
    const page = await service.browseFiles(collectionId, {
        // The service rejects any sort it does not know
        sort: singleQueryParam(req.query.sort) as FileSort | undefined,
        tags: listQueryParam(req.query.tags),
        cursor: singleQueryParam(req.query.cursor),
        limit: numberQueryParam(req.query.limit)
    });
    res.status(200).json({ status: "ok", ...page });
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
        contentDisposition(`thumbnail_${filename}`, { type: "inline" })
    );
    res.status(200).end(file);
}

async function handleGetCollectionImage(
    req: ApiRequest,
    res: ApiResponse,
    collectionId: string,
    imageId: string
) {
    const variant = singleQueryParam(req.query.variant);
    if (variant !== undefined && variant !== "scrubPreview") {
        throw new InvalidArgumentError(`Unknown variant '${variant}'`);
    }
    const service = new CollectionService(req.session.user.id);
    const { file, mimeType, filename } =
        variant === "scrubPreview"
            ? await service.getScrubPreview(collectionId, imageId)
            : await service.getFileBuffer(collectionId, imageId);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.setHeader(
        "Content-Disposition",
        contentDisposition(`${filename}`, { type: "inline" })
    );
    res.status(200).end(file);
}

/** A range of a video's original, or of its Rendition with &variant=rendition */
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
    const rangeStart = /^bytes=(\d+)-/.exec(range)?.[1];
    if (rangeStart === undefined) {
        throw new InvalidArgumentError(`Unsupported range header '${range}'`);
    }
    const chunkStart = Number(rangeStart);
    const variant = singleQueryParam(req.query.variant);
    if (variant !== undefined && variant !== "rendition") {
        throw new InvalidArgumentError(`Unknown variant '${variant}'`);
    }
    const service = new CollectionService(req.session.user.id);
    const { stream, chunkStartEnd, totalLengthBytes, mimeType, filename } =
        await service.getVideoStream(collectionId, videoId, chunkStart, {
            rendition: variant === "rendition"
        });

    const contentLength = chunkStartEnd[1] - chunkStartEnd[0] + 1;
    res.writeHead(206, {
        "Content-Range": `bytes ${chunkStartEnd[0]}-${chunkStartEnd[1]}/${totalLengthBytes}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition(`${filename}`)
    });

    // pipeline destroys the file stream when the client aborts (e.g. on seek)
    // and ends the response instead of crashing on a mid-stream read error
    pipeline(stream, res, () => {});
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
        validator: CollectionFileValidator
    }
});

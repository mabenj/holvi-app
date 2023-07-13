import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetFilesResult {
    collection?: CollectionDto;
    files?: CollectionFileDto[];
}

async function get(req: NextApiRequest, res: NextApiResponse) {
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
    res.status(404).end();
}

async function handleGetCollectionFiles(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetFilesResult>>,
    collectionId: string
) {
    const service = new CollectionService(req.session.user.id);
    const { notFound, collection, files } = await service.getCollectionFiles(
        collectionId?.toString() || ""
    );
    if (notFound || !collection) {
        res.status(404).json({ status: "error" });
        return;
    }
    res.status(200).json({ status: "ok", collection, files });
}

async function handleGetThumbnail(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<{}>>,
    collectionId: string,
    fileId: string
) {
    const service = new CollectionService(req.session.user.id);
    const { file, notFound, filename } = await service.getFile(
        collectionId,
        fileId,
        true
    );
    if (!file || notFound) {
        res.status(404).json({ status: "error" });
        return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.setHeader(
        "Content-Disposition",
        `inline; filename=thumbnail_${filename}`
    );
    res.status(200).end(file);
}

async function handleGetCollectionImage(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<{}>>,
    collectionId: string,
    imageId: string
) {
    const service = new CollectionService(req.session.user.id);
    const { file, mimeType, notFound, filename } = await service.getFile(
        collectionId,
        imageId
    );
    if (!file || !mimeType || notFound) {
        res.status(404).json({ status: "error" });
        return;
    }
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h
    res.setHeader("Content-Disposition", `inline; filename=${filename}`);
    res.status(200).end(file);
}

async function handleGetCollectionVideo(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<{}>>,
    collectionId: string,
    videoId: string
) {
    const range = req.headers.range;
    if (!range) {
        res.status(400).json({
            status: "error",
            error: "Missing range header"
        });
        return;
    }
    const chunkStart = Number(range.replace(/\D/g, ""));
    const service = new CollectionService(req.session.user.id);
    const {
        stream,
        chunkStartEnd,
        totalLengthBytes,
        mimeType,
        notFound,
        filename
    } = await service.getVideoStream(collectionId, videoId, chunkStart);

    if (notFound || !stream || !chunkStartEnd) {
        res.status(404).json({ status: "error" });
        return;
    }

    const contentLength = chunkStartEnd[1] - chunkStartEnd[0] + 1;
    res.writeHead(206, {
        "Content-Range": `bytes ${chunkStartEnd[0]}-${chunkStartEnd[1]}/${totalLengthBytes}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename=${filename}`
    });

    stream.pipe(res);
}

export const config = {
    api: {
        responseLimit: false
    }
};

export default ApiRoute.create({ get: get });

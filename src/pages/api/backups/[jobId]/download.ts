import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { parseByteRange, toRangeResponse } from "@/lib/common/byte-range";
import { BackupService } from "@/lib/services/backup.service";
import contentDisposition from "content-disposition";
import { createReadStream } from "fs";
import { pipeline } from "stream";

async function download(req: ApiRequest, res: ApiResponse) {
    const { jobId } = req.query as { jobId: string };
    const service = new BackupService(req.session.user.id);
    const { filePath, fileName, sizeBytes } = await service.openDownload(jobId);
    // Rejected before anything is sent if the range cannot be served
    const range = parseByteRange(req.headers.range, sizeBytes);

    const { statusCode, headers } = toRangeResponse(range, sizeBytes);
    res.writeHead(statusCode, {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(fileName),
        ...headers
    });

    // pipeline destroys the file stream when the client aborts the download
    pipeline(createReadStream(filePath, range ?? {}), res, () => {});
}

export const config = {
    api: {
        responseLimit: false
    }
};

export default ApiRoute.create({
    get: download
});

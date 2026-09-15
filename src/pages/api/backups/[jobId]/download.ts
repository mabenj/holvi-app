import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { BackupService } from "@/lib/services/backup.service";
import contentDisposition from "content-disposition";
import { createReadStream } from "fs";
import { pipeline } from "stream";

async function download(req: ApiRequest, res: ApiResponse) {
    const { jobId } = req.query as { jobId: string };
    const service = new BackupService(req.session.user.id);
    const { filePath, fileName, sizeBytes } = await service.openDownload(
        jobId
    );

    res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Length": sizeBytes,
        "Content-Disposition": contentDisposition(fileName)
    });

    // pipeline destroys the file stream when the client aborts the download
    pipeline(createReadStream(filePath), res, () => {});
}

export const config = {
    api: {
        responseLimit: false
    }
};

export default ApiRoute.create({
    get: download
});

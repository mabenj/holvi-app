import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import {
    VideoProcessingService,
    VideoProcessingStatus
} from "@/lib/services/video-processing.service";

/** How far video processing has got with the user's videos */
async function getStatus(
    req: ApiRequest,
    res: ApiResponse<{ processing?: VideoProcessingStatus }>
) {
    const service = new VideoProcessingService(req.session.user.id);
    const processing = await service.getStatus();
    res.status(200).json({ status: "ok", processing });
}

/** Queues the user's videos that were never processed or failed */
async function processVideos(
    req: ApiRequest,
    res: ApiResponse<{ processing?: VideoProcessingStatus }>
) {
    const service = new VideoProcessingService(req.session.user.id);
    const processing = await service.processVideos();
    res.status(202).json({ status: "ok", processing });
}

export default ApiRoute.create({
    get: getStatus,
    post: processVideos
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import {
    FailedVideo,
    VideoProcessingService
} from "@/lib/services/video-processing.service";

/** The user's videos whose processing failed, with the error each failed with */
async function getFailedVideos(
    req: ApiRequest,
    res: ApiResponse<{ videos?: FailedVideo[] }>
) {
    const service = new VideoProcessingService(req.session.user.id);
    const videos = await service.getFailedVideos();
    res.status(200).json({ status: "ok", videos });
}

export default ApiRoute.create({
    get: getFailedVideos
});

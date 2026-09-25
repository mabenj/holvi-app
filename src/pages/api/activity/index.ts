import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { Activity, ActivityService } from "@/lib/services/activity.service";

/** The user's queued or running Backup job and how far video processing has got */
async function getActivity(
    req: ApiRequest,
    res: ApiResponse<{ activity?: Activity }>
) {
    const activity = await new ActivityService(req.session.user.id).getActivity();
    res.status(200).json({ status: "ok", activity });
}

export default ApiRoute.create({
    get: getActivity
});

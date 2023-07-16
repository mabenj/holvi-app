import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";

function post(req: ApiRequest, res: ApiResponse) {
    req.session.destroy();
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    post: {
        handler: post
    }
});

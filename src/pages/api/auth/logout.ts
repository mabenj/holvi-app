import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import type { NextApiRequest, NextApiResponse } from "next";

function post(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
    req.session.destroy();
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({ post });

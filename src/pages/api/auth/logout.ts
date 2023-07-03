import { ApiRoute } from "@/lib/common/api-route";
import type { NextApiRequest, NextApiResponse } from "next";

interface Data {
    status: "ok" | "error";
    error?: string;
}

function post(req: NextApiRequest, res: NextApiResponse<Data>) {
    req.session.destroy();
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({ post });

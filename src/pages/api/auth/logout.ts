import { ApiRoute } from "@/lib/common/api-route";
import Log from "@/lib/common/log";
import type { NextApiRequest, NextApiResponse } from "next";

interface Data {
    status: "ok" | "error";
    error?: string;
}

export default ApiRoute.post(handler);

function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    try {
        req.session.destroy();
        res.status(200).json({ status: "ok" });
    } catch (error) {
        Log.error("Error logging user out", error);
        res.status(500).json({
            status: "error",
            error: "Error logging out"
        });
    }
}

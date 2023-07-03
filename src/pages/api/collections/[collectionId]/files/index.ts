import { ApiRoute } from "@/lib/common/api-route";
import type { NextApiRequest, NextApiResponse } from "next";

interface ResponseData {
    status: "ok" | "error";
    error?: string;
}

async function getFiles(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    res.status(501).end();
}

export default ApiRoute.create({ get: getFiles });

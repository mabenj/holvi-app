import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { CollectionFile } from "@/lib/interfaces/collection-file";
import type { NextApiRequest, NextApiResponse } from "next";

interface GetAllResult {
    files?: CollectionFile[];
}

async function getFiles(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<GetAllResult>>
) {
    res.status(501).end();
}

export default ApiRoute.create({ get: getFiles });

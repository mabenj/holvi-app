import { ApiRoute } from "@/lib/common/api-route";
import { Collection } from "@/lib/interfaces/collection";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collections?: Collection[];
};

export default ApiRoute.create({ get });

async function get(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    const collectionService = new CollectionService(req.session.user.id);
    const collections = await collectionService.getAll();
    res.status(200).json({ status: "ok", collections });
}

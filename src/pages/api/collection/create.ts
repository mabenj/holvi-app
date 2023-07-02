import { withPost, withUser } from "@/lib/common/api-route-helpers";
import { Collection } from "@/lib/interfaces/collection";
import AuthService from "@/lib/services/auth.service";
import { CollectionService } from "@/lib/services/collection.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
    collection?: Collection;
};

export default withPost(withUser(handler));

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method !== "POST") {
        res.status(404);
        return;
    }
    const user = await AuthService.validateUser(req.session);
    if (!user) {
        res.status(401).json({ status: "error" });
        return;
    }

    try {
        const { name, tags } = JSON.parse(req.body);
        const collectionService = new CollectionService(req.session.user.id);
        const { collection, error } = await collectionService.create(
            name,
            tags
        );
        if (!collection || error) {
            res.status(400).json({ status: "error", error });
            return;
        }

        res.status(201).json({ status: "ok", collection });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "error",
            error: JSON.stringify(error)
        });
    }
}

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { CollectionService } from "@/lib/services/collection.service";
import { z } from "zod";

async function multiDelete(req: ApiRequest<string[]>, res: ApiResponse) {
    const service = new CollectionService(req.session.user.id);
    await service.multiDelete(req.body);
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({
    post: {
        handler: multiDelete,
        validator: z.array(z.string().uuid())
    }
});

import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import TagService, {
    BulkTagChanges,
    TagsById
} from "@/lib/services/tag.service";
import { z } from "zod";

/** Adds and removes tags on a selection of the user's collections or files, all at once */
async function bulkTag(
    // The service rejects any target it does not know
    req: ApiRequest<BulkTagChanges>,
    res: ApiResponse<{ tags: TagsById }>
) {
    const service = new TagService(req.session.user.id);
    const tags = await service.bulkTag(req.body);
    res.status(200).json({ status: "ok", tags });
}

export default ApiRoute.create({
    post: {
        handler: bulkTag,
        // The service checks the target, the tags themselves, and which ids are the user's
        validator: z.object({
            target: z.string(),
            ids: z.array(z.string().uuid()).min(1),
            add: z.array(z.string()),
            remove: z.array(z.string())
        })
    }
});

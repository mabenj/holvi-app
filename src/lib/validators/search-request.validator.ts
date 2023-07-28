import { z } from "zod";

export const SearchRequestValidator = z.object({
    collectionId: z.string().uuid().optional(),
    query: z.string(),
    tags: z.array(z.string()),
    sort: z.object({
        field: z.enum(["name", "timestamp"]),
        asc: z.boolean()
    })
});

export type SearchRequest = z.infer<typeof SearchRequestValidator>;

import { z } from "zod";

export const UpdateCollectionValidator = z.object({
    id: z.string().uuid(),
    name: z
        .string()
        .min(1, "Collection name must be at least 1 character long")
        .max(20, "Collection name must be less than 20 characters long"),
    tags: z.array(
        z
            .string()
            .min(1, "Tag must be at least 1 character long")
            .max(20, "Tag must be less than 20 characters long")
    )
});

export type UpdateCollectionData = z.infer<typeof UpdateCollectionValidator>
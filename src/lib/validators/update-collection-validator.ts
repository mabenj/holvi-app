import { z } from "zod";

export const UpdateCollectionValidator = z.object({
    id: z.string().uuid(),
    name: z
        .string()
        .min(1, "Collection name must be at least 1 character long")
        .max(100, "Collection name must be less than 100 characters long"),
    description: z
        .string()
        .max(
            255,
            "Collection description must be less than 255 characters long"
        )
        .optional(),
    tags: z.array(
        z
            .string()
            .min(1, "Tag must be at least 1 character long")
            .max(50, "Tag must be less than 50 characters long")
    )
});

export type UpdateCollectionData = z.infer<typeof UpdateCollectionValidator>;

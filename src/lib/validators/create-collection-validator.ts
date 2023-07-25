import { z } from "zod";

export const CreateCollectionValidator = z.object({
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
    tags: z
        .array(z.string())
        .refine((values) => values.every((value) => value.length > 0), {
            message: "Tags must be at least 1 characters long"
        })
        .refine((values) => values.every((value) => value.length < 50), {
            message: "Tags must be less than 50 characters long"
        })
});

export type CreateCollectionFormData = z.infer<
    typeof CreateCollectionValidator
>;

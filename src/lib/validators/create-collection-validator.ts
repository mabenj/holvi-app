import { z } from "zod";

export const CreateCollectionValidator = z.object({
    name: z
        .string()
        .min(1, "Collection name must be at least 1 character long")
        .max(20, "Collection name must be less than 20 characters long"),
    tags: z
        .array(z.string())
        .refine((values) => values.every((value) => value.length > 0), {
            message: "Tags must be at least 1 characters long"
        })
        .refine((values) => values.every((value) => value.length < 20), {
            message: "Tags must be less than 20 characters long"
        })
});

export type CreateCollectionFormData = z.infer<
    typeof CreateCollectionValidator
>;

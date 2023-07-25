import { z } from "zod";

export const UpdateCollectionFileValidator = z.object({
    id: z.string().uuid(),
    name: z
        .string()
        .min(1, "File name must be at least 1 character long")
        .max(100, "File name must be less than 100 characters long"),
    tags: z
        .array(z.string())
        .refine((values) => values.every((value) => value.length > 1), {
            message: "Tags must be at least 1 characters long"
        })
        .refine((values) => values.every((value) => value.length < 50), {
            message: "Tags must be less than 50 characters long"
        })
});

export type UpdateCollectionFileData = z.infer<
    typeof UpdateCollectionFileValidator
>;

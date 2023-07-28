import { z } from "zod";

const NAME_MIN = 1;
const NAME_MAX = 100;
const DESC_MAX = 255;
const TAG_MIN = 1;
const TAG_MAX = 50;

export const CollectionValidator = z.object({
    name: z
        .string()
        .min(
            NAME_MIN,
            `Collection name must be at least ${NAME_MIN} character long`
        )
        .max(
            NAME_MAX,
            `Collection name must be less than ${NAME_MAX} characters long`
        ),
    description: z
        .string()
        .max(
            DESC_MAX,
            `Collection description must be less than ${DESC_MAX} characters long`
        )
        .optional(),
    tags: z
        .array(z.string())
        .refine((values) => values.every((value) => value.length >= TAG_MIN), {
            message: `Tags must be at least ${TAG_MIN} characters long`
        })
        .refine((values) => values.every((value) => value.length <= TAG_MAX), {
            message: `Tags must be less than ${TAG_MAX} characters long`
        })
});

export type CollectionFormData = z.infer<typeof CollectionValidator>;

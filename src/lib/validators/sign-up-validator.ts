import { z } from "zod";

export const SignUpValidator = z
    .object({
        username: z
            .string()
            .min(3, { message: "Username must be at least 3 characters long" })
            .max(20, {
                message: "Username must be less than 20 characters long"
            })
            .regex(/^[a-zA-Z0-9_]+$/, {
                message: "Username must contain only allowed characters"
            }),
        password: z
            .string()
            .min(8, { message: "Password must be at least 8 characters long" })
            .max(100, {
                message: "Password must be less than 100 characters long"
            }),
        confirmPassword: z
            .string()
            .min(8, { message: "Password must be at least 8 characters long" })
            .max(100, {
                message: "Password must be less than 100 characters long"
            })
    })
    .refine(({ password, confirmPassword }) => password === confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    });

export type SignUpFormData = z.infer<typeof SignUpValidator>;

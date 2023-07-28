import { z } from "zod";

const USER_MIN = 3;
const USER_MAX = 20;
const USER_REGEX = /^[a-zA-Z0-9_]+$/;
const PWD_MIN = 8;
const PWD_MAX = 100;

export const SignUpValidator = z
    .object({
        username: z
            .string()
            .min(
                USER_MIN,
                `Username must be at least ${USER_MIN} characters long`
            )
            .max(
                USER_MAX,
                `Username must be less than ${USER_MAX} characters long`
            )
            .regex(USER_REGEX, "Username must contain only allowed characters"),
        password: z
            .string()
            .min(
                PWD_MIN,
                `Password must be at least ${PWD_MIN} characters long`
            )
            .max(
                PWD_MAX,
                `Password must be less than ${PWD_MAX} characters long`
            ),
        confirmPassword: z
            .string()
            .min(
                PWD_MIN,
                `Password must be at least ${PWD_MIN} characters long`
            )
            .max(
                PWD_MAX,
                `Password must be less than ${PWD_MAX} characters long`
            )
    })
    .refine(({ password, confirmPassword }) => password === confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    });

export type SignUpFormData = z.infer<typeof SignUpValidator>;

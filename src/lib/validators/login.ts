import { z } from "zod";

export const LoginValidator = z.object({
    username: z.string(),
    password: z.string()
});

export type LoginFormData = z.infer<typeof LoginValidator>;

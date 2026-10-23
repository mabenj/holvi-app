import { z } from "zod";

export const StartRestoreValidator = z.object({
    sourceId: z.string().min(1)
});

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SESSION_PASSWORD: z.string().min(32),
    SESSION_TTL_SECONDS: z.coerce.number().default(7200), // 2 hours
    SESSION_HTTPS: z.coerce.boolean().default(false),
    ENCRYPTION_KEY: z.string(),
    DATA_DIR: z.string(),
    MAX_FILE_SIZE_KB: z.coerce.number().default(4_294_967_296), // 4GB
    MAX_TOTAL_FILE_SIZE_KB: z.coerce.number().default(17_179_869_184), // 16GB
    GEO_API_KEY: z.string().optional(),
    STREAM_CHUNK_SIZE_KB: z.coerce.number().default(3_000_000), // 3MB
    THUMBNAIL_MAX_WIDTH: z.coerce.number().default(600),
    THUMBNAIL_MAX_HEIGHT: z.coerce.number().default(600),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SESSION_PASSWORD: process.env.SESSION_PASSWORD,
    SESSION_TTL_SECONDS: process.env.SESSION_TTL_SECONDS,
    SESSION_HTTPS: process.env.SESSION_HTTPS,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    DATA_DIR: process.env.DATA_DIR,
    MAX_FILE_SIZE_KB: process.env.MAX_FILE_SIZE_KB,
    MAX_TOTAL_FILE_SIZE_KB: process.env.MAX_TOTAL_FILE_SIZE_KB,
    GEO_API_KEY: process.env.GEO_API_KEY,
    STREAM_CHUNK_SIZE_KB: process.env.STREAM_CHUNK_SIZE_KB,
    THUMBNAIL_MAX_WIDTH: process.env.THUMBNAIL_MAX_WIDTH,
    THUMBNAIL_MAX_HEIGHT: process.env.THUMBNAIL_MAX_HEIGHT,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

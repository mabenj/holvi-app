import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src")
        }
    },
    test: {
        include: ["src/**/*.test.ts"],
        setupFiles: ["test/setup-env.ts"],
        // Integration tests share one Postgres database and reset it between tests
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 60_000
    }
});

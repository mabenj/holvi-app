import { mkdirSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll } from "vitest";

// Runs before each test file's imports, so the app config reads these values.

const DEFAULT_TEST_DB_CONNECTION_STRING =
    "postgres://admin:admin@localhost:5433/holvi_test";

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "holvi-test-"));
const dataDir = path.join(tempRoot, "data");
const backupDir = path.join(tempRoot, "backups");
mkdirSync(dataDir);
mkdirSync(backupDir);

process.env.HOLVI_DATA_DIR = dataDir;
process.env.HOLVI_BACKUP_DIR = backupDir;
process.env.HOLVI_DB_CONNECTION_STRING =
    process.env.HOLVI_TEST_DB_CONNECTION_STRING ||
    DEFAULT_TEST_DB_CONNECTION_STRING;
process.env.HOLVI_ENCRYPTION_KEY = "test-encryption-key-32-chars-xxx";
process.env.HOLVI_SESSION_PASSWORD = "test-session-password-32-chars-x";
process.env.HOLVI_GEO_API_KEY = "test-geo-api-key";

afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
});

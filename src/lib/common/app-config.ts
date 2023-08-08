const MEGABYTE = 1_000_000;
const GIGABYTE = 1_000 * MEGABYTE;
const HOUR = 60 * 60;

const appConfig = {
    connectionString: getEnvVariable("HOLVI_DB_CONNECTION_STRING"),
    maxFileUploadSize: getEnvVariable(
        "HOLVI_MAX_FILE_SIZE_KB",
        "number",
        4 * GIGABYTE
    ),
    maxTotalFileUploadSize: getEnvVariable(
        "HOLVI_MAX_TOTAL_FILE_SIZE_KB",
        "number",
        16 * GIGABYTE
    ),
    dataDir: getEnvVariable("HOLVI_DATA_DIR"),
    sessionOptions: {
        password: getEnvVariable("HOLVI_SESSION_PASSWORD"),
        cookieName: "holviapp",
        cookieOptions: {
            maxAge: undefined,
            secure:
                getEnvVariable("HOLVI_USE_HTTPS", "boolean", true) &&
                process.env.NODE_ENV === "production",
            ttl: getEnvVariable("HOLVI_SESSION_TTL_SECONDS", "number", 2 * HOUR)
        }
    },
    streamChunkSize: getEnvVariable(
        "HOLVI_STREAM_CHUNK_SIZE_KB",
        "number",
        3 * MEGABYTE
    ),
    geoApiKey: getEnvVariable("HOLVI_GEO_API_KEY"),
    thumbnailMaxWidth: 600,
    thumbnailMaxHeight: 600,
    encryptionKey: getEnvVariable("HOLVI_ENCRYPTION_KEY")
} as const;

export default appConfig;

function getEnvVariable(
    key: string,
    type?: "string",
    defaultValue?: string
): string;

function getEnvVariable(
    key: string,
    type: "number",
    defaultValue?: number
): number;

function getEnvVariable(
    key: string,
    type?: "boolean",
    defaultValue?: boolean
): boolean;

function getEnvVariable(
    key: string,
    type?: "string" | "number" | "boolean",
    defaultValue?: string | number | boolean
): string | number | boolean {
    let value = process.env[key];
    if (!value) {
        if (defaultValue) {
            return defaultValue;
        }
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            throw new Error(`Couldn't find environment variable '${key}'`);
        }
        value = "0";
    }
    if (type === "number") {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || !isFinite(parsed)) {
            throw new Error(`Could not parse number from '${value}'`);
        }
        return parsed;
    }
    if (type === "boolean") {
        return value.toLowerCase() === "true" || value === "1";
    }
    return value;
}

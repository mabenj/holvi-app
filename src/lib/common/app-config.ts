const isProd = process.env.NODE_ENV === "production";

if (!isProd && !process.env.DB_CONNECTION_STRING) {
    throw new Error(
        "Database connection string is not defined (use environment variable 'DB_CONNECTION_STRING')"
    );
}

if (!isProd && !process.env.DATA_DIR) {
    throw new Error(
        "Data directory is not defined (use environment variable 'DATA_DIR')"
    );
}

if (
    !isProd &&
    (!process.env.SESSION_PASSWORD || process.env.SESSION_PASSWORD.length < 32)
) {
    throw new Error(
        "Missing a 32 characters long session password. Generate one at https://1password.com/password-generator/ and use environment variable 'SESSION_PASSWORD'"
    );
}

interface AppConfig {
    readonly connectionString: string;
    readonly maxFileUploadSize: number;
    readonly maxTotalFileUploadSize: number;
    readonly dataDir: string;
    readonly sessionOptions: {
        readonly password: string;
        readonly cookieName: string;
        readonly cookieOptions: {
            readonly maxAge: undefined;
            readonly secure: boolean;
            readonly ttl: number;
        };
    };
    readonly streamChunkSize: number;
}

const appConfig: AppConfig = {
    connectionString: process.env.DB_CONNECTION_STRING || "",
    maxFileUploadSize:
        parseInt(process.env.MAX_FILE_SIZE_KB || "0", 10) || 1024 * 1024 * 1024 * 4, // default to 4gb
    maxTotalFileUploadSize:
        parseInt(process.env.MAX_TOTAL_FILE_SIZE_KB || "0", 10) ||
        1024 * 1024 * 1024 * 16, // default to 16gb
    dataDir: process.env.DATA_DIR || "",
    sessionOptions: {
        password: process.env.SESSION_PASSWORD || "",
        cookieName: "holviapp",
        cookieOptions: {
            maxAge: undefined,
            secure:
                process.env.USE_HTTPS?.toLowerCase() === "true" &&
                process.env.NODE_ENV === "production",
            ttl: parseInt(process.env.SESSION_TTL_SECONDS || "0", 10) || 2 * 60 * 60 // default to 2 hr
        }
    },
    streamChunkSize: parseInt(process.env.STREAM_CHUNK_SIZE_KB || "0", 10) || 3_000_000 // default to 3 mb
};

export default appConfig;

// export default class AppConfig {
//     static readonly maxFileUploadSize =
//         parseInt(process.env.MAX_FILE_SIZE_KB || "0") || 1024 * 1024 * 1024 * 4; // default to 4gb
//     static readonly maxTotalFileUploadSize =
//         parseInt(process.env.MAX_TOTAL_FILE_SIZE_KB || "0") ||
//         1024 * 1024 * 1024 * 16; // default to 16gb

//     static get connectionString() {
//         if (!process.env.DB_CONNECTION_STRING) {
//             throw new Error(
//                 "Database connection string is not defined (use environment variable 'DB_CONNECTION_STRING')"
//             );
//         }
//         return process.env.DB_CONNECTION_STRING;
//     }

//     static get dataDir() {
//         if (!process.env.DATA_DIR) {
//             throw new Error(
//                 "Data directory is not defined (use environment variable 'DATA_DIR')"
//             );
//         }
//         return process.env.DATA_DIR;
//     }

//     static get sessionOptions() {
//         if (
//             !process.env.SESSION_PASSWORD ||
//             process.env.SESSION_PASSWORD.length < 32
//         ) {
//             throw new Error(
//                 "Missing a 32 characters long session password. Generate one at https://1password.com/password-generator/ and use environment variable 'SESSION_PASSWORD'"
//             );
//         }
//         return {
//             password: process.env.SESSION_PASSWORD,
//             cookieName: "holviapp",
//             cookieOptions: {
//                 maxAge: undefined,
//                 secure:
//                     process.env.USE_HTTPS?.toLowerCase() === "true" &&
//                     process.env.NODE_ENV === "production",
//                 ttl:
//                     parseInt(process.env.SESSION_TTL_SECONDS || "0") ||
//                     2 * 60 * 60 // default to 2 hr
//             }
//         };
//     }
// }

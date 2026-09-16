// Characters that are illegal in file names on Windows, and control characters
const ILLEGAL_CHARACTERS = /[\x00-\x1f\x7f<>:"/\\|?*]/g;
// Device names Windows reserves, also when followed by spaces or an extension
const RESERVED_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])( *(?:\..*)?)$/i;
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;
// A final dot followed by letters and digits, at least one of them a letter, e.g. ".jpg" or ".mp4"
const EXTENSION = /\.(?=[a-z0-9]*[a-z])[a-z0-9]{1,16}$/i;
// Well below the 255-byte limit of common file systems, so whole paths stay short
const MAX_NAME_BYTES = 100;

// Uploads accept any image or video type, so the common ones are covered
const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/svg+xml": ".svg",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "video/x-msvideo": ".avi",
    "video/mpeg": ".mpeg",
    "video/ogg": ".ogv",
    "video/3gpp": ".3gp"
};

/**
 * Hands out the names that make up Backup paths (collection folders and file
 * names), derived from stored names: safe to extract on any common file
 * system, capped in length, and unique within one folder. Uniqueness ignores
 * case and Unicode normalisation, so names cannot overwrite each other on file
 * systems that ignore either.
 */
export class UniqueSafeNames {
    private readonly taken = new Set<string>();

    /**
     * @param mimeType when given, a name without an extension gets one derived
     * from it; existing extensions are kept verbatim
     */
    claim(storedName: string, mimeType?: string) {
        const safeName = replaceUnsafeCharacters(storedName);
        const ownExtension = safeName.match(EXTENSION)?.[0] ?? "";
        const base = safeName.slice(0, safeName.length - ownExtension.length);
        const extension =
            ownExtension || (mimeType ? getExtensionForMimeType(mimeType) : "");
        let candidate = fitName(base, extension);
        for (let copy = 2; this.taken.has(candidate.toLowerCase()); copy++) {
            candidate = fitName(base, ` (${copy})${extension}`);
        }
        this.taken.add(candidate.toLowerCase());
        return candidate;
    }
}

function replaceUnsafeCharacters(name: string) {
    const safe = name
        .normalize("NFC")
        .replace(ILLEGAL_CHARACTERS, "_")
        .replace(TRAILING_DOTS_AND_SPACES, "");
    return safe || "_";
}

function getExtensionForMimeType(mimeType: string) {
    // Without parameters such as "; charset=..."
    const type = mimeType.split(";")[0].trim().toLowerCase();
    return EXTENSIONS_BY_MIME_TYPE[type] ?? "";
}

/**
 * Joins `base` and `ending`, shortening `base` so the result fits the maximum
 * length, and renames the result if it is a reserved device name.
 */
function fitName(base: string, ending: string) {
    const budget = MAX_NAME_BYTES - byteLength(ending);
    let fitted = base;
    if (byteLength(base) > budget) {
        fitted = "";
        // Whole code points only, so characters are never split
        for (const character of base) {
            if (byteLength(fitted + character) > budget) {
                break;
            }
            fitted += character;
        }
        // Truncation can expose dots or spaces, which Windows drops from the end of a name
        fitted = fitted.replace(TRAILING_DOTS_AND_SPACES, "") || "_";
    }
    return (fitted + ending).replace(
        RESERVED_NAME,
        (_, device, rest) => `${device}_${rest}`
    );
}

function byteLength(value: string) {
    return Buffer.byteLength(value, "utf8");
}

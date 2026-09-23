import { InvalidArgumentError } from "../common/errors";

/** Keyset paging shared by the browsing services: page sizes and opaque cursors */

export const DEFAULT_BROWSE_LIMIT = 48;
export const MAX_BROWSE_LIMIT = 200;

export const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page size a query asks for, or the default */
export function pageLimit(limit: number | undefined) {
    const value = limit ?? DEFAULT_BROWSE_LIMIT;
    if (!Number.isInteger(value) || value < 1 || value > MAX_BROWSE_LIMIT) {
        throw new InvalidArgumentError(
            `Limit must be a whole number from 1 to ${MAX_BROWSE_LIMIT}`
        );
    }
    return value;
}

/** An opaque cursor holding where a page ends: base64url JSON of the parts */
export function encodeCursor(parts: string[]) {
    return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

/**
 * The parts of a cursor made by encodeCursor, if `isValid` accepts them.
 * Anything else is a malformed cursor.
 */
export function decodeCursor<T extends string[]>(
    cursor: string,
    isValid: (parts: string[]) => parts is T
): T {
    try {
        const parts: unknown = JSON.parse(
            Buffer.from(cursor, "base64url").toString("utf8")
        );
        if (
            Array.isArray(parts) &&
            parts.every((part) => typeof part === "string") &&
            isValid(parts)
        ) {
            return parts;
        }
    } catch {
        // Falls through to the error below
    }
    throw new InvalidArgumentError("Malformed cursor");
}

import { RangeNotSatisfiableError } from "./errors";

/** A stretch of a file to serve, both ends inclusive, as `Content-Range` states them */
export interface ByteRange {
    start: number;
    end: number;
}

/** One range: `bytes=<first>-<last>`, `bytes=<first>-` or `bytes=-<suffix length>` */
const SINGLE_BYTE_RANGE = /^bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/;

/**
 * The byte range a request asks for, or null for the whole file. A range this
 * server does not serve (several ranges at once, an unknown unit, an end before
 * its start) is ignored rather than rejected, as HTTP allows, so the client
 * still gets the file. A range starting past the end of the file is rejected,
 * because serving something else instead would corrupt a resumed download.
 */
export function parseByteRange(
    header: string | undefined,
    totalSize: number
): ByteRange | null {
    const match = header ? SINGLE_BYTE_RANGE.exec(header.trim()) : null;
    if (!match) {
        return null;
    }
    const [, first, last] = match;
    if (first === "") {
        // `bytes=-<suffix length>`: the last bytes of the file
        if (last === "") {
            return null;
        }
        const suffixLength = Number(last);
        if (suffixLength === 0 || totalSize === 0) {
            throw unsatisfiable(totalSize);
        }
        return {
            start: Math.max(0, totalSize - suffixLength),
            end: totalSize - 1
        };
    }
    const start = Number(first);
    if (start >= totalSize) {
        throw unsatisfiable(totalSize);
    }
    const end =
        last === "" ? totalSize - 1 : Math.min(Number(last), totalSize - 1);
    if (end < start) {
        return null;
    }
    return { start, end };
}

/** The status and headers answering a download request, ranged or whole */
export interface RangeResponse {
    statusCode: 200 | 206;
    headers: Record<string, string | number>;
}

/**
 * How to answer a request for `range` (null for the whole file) of a file of
 * `totalSize` bytes. Every answer offers ranges, so a client that loses the
 * connection knows it can resume rather than start the download again.
 */
export function toRangeResponse(
    range: ByteRange | null,
    totalSize: number
): RangeResponse {
    if (!range) {
        return {
            statusCode: 200,
            headers: { "Accept-Ranges": "bytes", "Content-Length": totalSize }
        };
    }
    return {
        statusCode: 206,
        headers: {
            "Accept-Ranges": "bytes",
            // Both ends are inclusive, so a single byte is one byte long
            "Content-Length": range.end - range.start + 1,
            "Content-Range": `bytes ${range.start}-${range.end}/${totalSize}`
        }
    };
}

function unsatisfiable(totalSize: number) {
    return new RangeNotSatisfiableError(
        `Cannot serve that range of a ${totalSize} byte file`,
        totalSize
    );
}

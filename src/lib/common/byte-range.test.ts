import { describe, expect, it } from "vitest";
import { parseByteRange, toRangeResponse } from "./byte-range";
import { RangeNotSatisfiableError } from "./errors";

const TOTAL_SIZE = 10;

describe("parseByteRange", () => {
    it("asks for the whole file when there is no usable range", () => {
        // A range this server cannot serve is ignored rather than rejected,
        // so the client still gets the file
        const wholeFile = [
            undefined,
            "",
            "bytes=",
            "bytes=abc",
            // Unknown unit
            "items=0-5",
            // Several ranges at once
            "bytes=0-1,5-6",
            // Ends before it starts
            "bytes=5-3"
        ];
        for (const header of wholeFile) {
            expect(parseByteRange(header, TOTAL_SIZE)).toBeNull();
        }
    });

    it("reads from an offset to the end of the file", () => {
        expect(parseByteRange("bytes=0-", TOTAL_SIZE)).toEqual({
            start: 0,
            end: 9
        });
        expect(parseByteRange("bytes=5-", TOTAL_SIZE)).toEqual({
            start: 5,
            end: 9
        });
        expect(parseByteRange("bytes=9-", TOTAL_SIZE)).toEqual({
            start: 9,
            end: 9
        });
    });

    it("reads an explicit range, ending at the last byte if it reaches past it", () => {
        expect(parseByteRange("bytes=0-4", TOTAL_SIZE)).toEqual({
            start: 0,
            end: 4
        });
        expect(parseByteRange("bytes=3-3", TOTAL_SIZE)).toEqual({
            start: 3,
            end: 3
        });
        expect(parseByteRange("bytes=5-100", TOTAL_SIZE)).toEqual({
            start: 5,
            end: 9
        });
    });

    it("reads the last bytes of the file from a suffix range", () => {
        expect(parseByteRange("bytes=-3", TOTAL_SIZE)).toEqual({
            start: 7,
            end: 9
        });
        expect(parseByteRange("bytes=-100", TOTAL_SIZE)).toEqual({
            start: 0,
            end: 9
        });
    });

    it("ignores optional whitespace around the range", () => {
        expect(parseByteRange(" bytes = 2 - 4 ", TOTAL_SIZE)).toEqual({
            start: 2,
            end: 4
        });
    });

    it("rejects a range that starts past the end of the file", () => {
        for (const header of ["bytes=10-", "bytes=10-12", "bytes=999-"]) {
            expect(() => parseByteRange(header, TOTAL_SIZE)).toThrow(
                RangeNotSatisfiableError
            );
        }
        // Reports the file's size, so the client can ask again
        expect(() => parseByteRange("bytes=10-", TOTAL_SIZE)).toThrow(
            expect.objectContaining({ totalSize: TOTAL_SIZE })
        );
    });

    it("rejects a request for the last zero bytes", () => {
        expect(() => parseByteRange("bytes=-0", TOTAL_SIZE)).toThrow(
            RangeNotSatisfiableError
        );
    });

    it("rejects every range of an empty file", () => {
        expect(() => parseByteRange("bytes=0-", 0)).toThrow(
            RangeNotSatisfiableError
        );
        expect(() => parseByteRange("bytes=-1", 0)).toThrow(
            RangeNotSatisfiableError
        );
    });
});

describe("toRangeResponse", () => {
    it("sends the whole file, offering ranges for a download that has to resume", () => {
        expect(toRangeResponse(null, 1_000)).toEqual({
            statusCode: 200,
            headers: { "Accept-Ranges": "bytes", "Content-Length": 1_000 }
        });
    });

    it("sends a range as partial content, counting both of its ends", () => {
        expect(toRangeResponse({ start: 200, end: 999 }, 1_000)).toEqual({
            statusCode: 206,
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Length": 800,
                "Content-Range": "bytes 200-999/1000"
            }
        });
        expect(toRangeResponse({ start: 5, end: 5 }, 10)).toEqual({
            statusCode: 206,
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Length": 1,
                "Content-Range": "bytes 5-5/10"
            }
        });
    });
});

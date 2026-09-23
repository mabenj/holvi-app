import { FileSummary } from "@/lib/types/file-summary";
import { describe, expect, it } from "vitest";
import { rowOfFile, timelineRows } from "./timeline-rows";

function file(id: string, date: string): FileSummary {
    return {
        id,
        collectionId: "c1",
        name: `${id}.jpg`,
        mimeType: "image/jpeg",
        src: `/src/${id}`,
        thumbnailSrc: `/thumb/${id}`,
        timestamp: new Date(date).getTime(),
        tags: []
    };
}

describe("rowOfFile", () => {
    // Two months: a header and two rows of tiles each, three to a row
    const files = [
        file("a", "2026-09-20T12:00:00"),
        file("b", "2026-09-19T12:00:00"),
        file("c", "2026-09-18T12:00:00"),
        file("d", "2026-09-17T12:00:00"),
        file("e", "2026-08-20T12:00:00"),
        file("f", "2026-08-19T12:00:00")
    ];
    const rows = timelineRows(files, 3);

    it("finds the row of tiles a file is in, past the month headers", () => {
        expect(rowOfFile(rows, "a")).toBe(1);
        expect(rowOfFile(rows, "c")).toBe(1);
        expect(rowOfFile(rows, "d")).toBe(2);
        expect(rowOfFile(rows, "f")).toBe(4);
    });

    it("finds no row for a file that is not loaded", () => {
        expect(rowOfFile(rows, "z")).toBe(-1);
    });
});

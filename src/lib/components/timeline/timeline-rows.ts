import { FileSummary } from "@/lib/types/file-summary";

/** One row of the Timeline grid: a month header, or up to one row of tiles */
export type TimelineRow =
    | { kind: "month"; key: string; month: string }
    | { kind: "files"; key: string; month: string; files: FileSummary[] };

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
});

/** The month a file's date falls in, e.g. "September 2026", in the viewer's time zone */
export function fileMonth(file: FileSummary) {
    return MONTH_FORMAT.format(new Date(file.timestamp));
}

/**
 * The Timeline's rows: each month's header, then its files, `columns` to a
 * row. The files are newest first, so each month's files are together.
 */
export function timelineRows(
    files: FileSummary[],
    columns: number
): TimelineRow[] {
    const rows: TimelineRow[] = [];
    // The row being filled with tiles
    let current = null as Extract<TimelineRow, { kind: "files" }> | null;
    for (const file of files) {
        const month = fileMonth(file);
        if (current?.month !== month) {
            rows.push({ kind: "month", key: `month-${file.id}`, month });
            current = null;
        }
        if (!current || current.files.length === columns) {
            current = {
                kind: "files",
                key: `files-${file.id}`,
                month,
                files: []
            };
            rows.push(current);
        }
        current.files.push(file);
    }
    return rows;
}

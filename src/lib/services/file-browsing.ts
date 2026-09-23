import Database from "@/db/Database";
import { InvalidArgumentError } from "../common/errors";
import { getFileSrc } from "../common/utilities";
import { FILE_SORTS, FileSort } from "../types/file-sort";
import { FileSummary } from "../types/file-summary";
import {
    decodeCursor,
    encodeCursor,
    pageLimit,
    UUID_PATTERN
} from "./keyset-paging";

export type { FileSort } from "../types/file-sort";

export interface BrowseFilesQuery {
    /** Newest first by default */
    sort?: FileSort;
    /** Opaque; from the previous page's nextCursor */
    cursor?: string;
    limit?: number;
}

export interface BrowseFilesPage {
    files: FileSummary[];
    nextCursor: string | null;
}

/** A file's date: when it was taken, or else when it was created */
const FILE_DATE = `COALESCE(f."takenAt", f."createdAt")`;

/** How each sort orders files, always with the id as the final tie-break */
const ORDERS: Record<
    FileSort,
    { key: string; keyType: string; direction: "ASC" | "DESC" }
> = {
    newest: { key: FILE_DATE, keyType: "timestamptz", direction: "DESC" },
    oldest: { key: FILE_DATE, keyType: "timestamptz", direction: "ASC" },
    // citext compares names ignoring case
    name: { key: `f.name`, keyType: "citext", direction: "ASC" }
};

/** Where a page ends: the sort it belongs to, the last file's sort key and its id */
type FileCursor = [sort: FileSort, key: string, id: string];

/** Dates travel in cursors as UTC with microseconds, so no precision is lost */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const MAX_NAME_KEY_LENGTH = 1024;

interface FileRow {
    id: string;
    CollectionId: string;
    name: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    thumbnailWidth: number | null;
    thumbnailHeight: number | null;
    gpsLatitude: string | number | null;
    gpsLongitude: string | number | null;
    gpsAltitude: string | number | null;
    gpsLabel: string | null;
    durationInSeconds: number | null;
    blurDataUrl: string | null;
    date: Date;
    sortKey: string;
}

/**
 * One page of a collection's files as summaries. The caller has checked that
 * the collection belongs to the user.
 */
export async function browseFiles(
    collectionId: string,
    query: BrowseFilesQuery
): Promise<BrowseFilesPage> {
    const sort = query.sort ?? "newest";
    if (!FILE_SORTS.includes(sort)) {
        throw new InvalidArgumentError(`Unknown sort '${sort}'`);
    }
    const limit = pageLimit(query.limit);
    const after = query.cursor
        ? decodeCursor(query.cursor, isFileCursor)
        : null;
    if (after && after[0] !== sort) {
        // Another sort's cursor points to a place this order does not have
        throw new InvalidArgumentError("Malformed cursor");
    }

    const { key, keyType, direction } = ORDERS[sort];
    const comparison = direction === "ASC" ? ">" : "<";
    const sortKey =
        keyType === "timestamptz"
            ? `to_char(${key} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
            : `${key}::text`;

    const db = await Database.getInstance();
    const rows = (await db.select(
        `SELECT f.id, f."CollectionId", f.name, f."mimeType", f.width, f.height,
                f."thumbnailWidth", f."thumbnailHeight", f."gpsLatitude",
                f."gpsLongitude", f."gpsAltitude", f."gpsLabel",
                f."durationInSeconds", f."blurDataUrl",
                ${FILE_DATE} AS date, ${sortKey} AS "sortKey"
            FROM "CollectionFiles" f
            WHERE f."CollectionId" = :collectionId
            ${
                after
                    ? `AND (${key}, f.id) ${comparison} (CAST(:afterKey AS ${keyType}), CAST(:afterId AS uuid))`
                    : ""
            }
            ORDER BY ${key} ${direction}, f.id ${direction}
            LIMIT :limit`,
        {
            collectionId,
            afterKey: after?.[1],
            afterId: after?.[2],
            // One extra row tells whether another page follows
            limit: limit + 1
        }
    )) as FileRow[];

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
        files: await summarizeFiles(pageRows),
        nextCursor:
            rows.length > limit && last
                ? encodeCursor([sort, last.sortKey, last.id])
                : null
    };
}

function isFileCursor(parts: string[]): parts is FileCursor {
    if (parts.length !== 3 || !UUID_PATTERN.test(parts[2])) {
        return false;
    }
    const [sort, key] = parts;
    if (sort === "name") {
        return key.length <= MAX_NAME_KEY_LENGTH;
    }
    return (
        (sort === "newest" || sort === "oldest") && DATE_KEY_PATTERN.test(key)
    );
}

async function summarizeFiles(rows: FileRow[]): Promise<FileSummary[]> {
    if (rows.length === 0) {
        return [];
    }
    const db = await Database.getInstance();
    const tags = (await db.select(
        `SELECT t."CollectionFileId" AS "fileId", t."TagName" AS name
            FROM "CollectionFileTags" t
            WHERE t."CollectionFileId" IN (:ids)
            ORDER BY t."TagName"`,
        { ids: rows.map((row) => row.id) }
    )) as { fileId: string; name: string }[];

    return rows.map((row) => {
        const source = {
            collectionId: row.CollectionId,
            fileId: row.id,
            mimeType: row.mimeType
        };
        const isVideo = row.mimeType.startsWith("video");
        const summary: FileSummary = {
            id: row.id,
            collectionId: row.CollectionId,
            name: row.name,
            mimeType: row.mimeType,
            src: getFileSrc(source),
            thumbnailSrc: getFileSrc({ ...source, thumbnail: true }),
            width: row.width ?? undefined,
            height: row.height ?? undefined,
            thumbnailWidth: row.thumbnailWidth ?? undefined,
            thumbnailHeight: row.thumbnailHeight ?? undefined,
            timestamp: new Date(row.date).getTime(),
            tags: tags
                .filter((tag) => tag.fileId === row.id)
                .map((tag) => tag.name),
            gps:
                row.gpsLatitude !== null && row.gpsLongitude !== null
                    ? {
                          lat: Number(row.gpsLatitude),
                          long: Number(row.gpsLongitude),
                          alt:
                              row.gpsAltitude === null
                                  ? undefined
                                  : Number(row.gpsAltitude),
                          label: row.gpsLabel ?? undefined
                      }
                    : undefined,
            durationInSeconds: row.durationInSeconds ?? undefined,
            blurDataUrl: row.blurDataUrl ?? undefined
        };
        // The original, until Renditions exist
        return isVideo ? { ...summary, playbackSrc: summary.src } : summary;
    });
}

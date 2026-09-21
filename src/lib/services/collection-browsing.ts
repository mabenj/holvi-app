import Database from "@/db/Database";
import { Collection } from "@/db/models/Collection";
import { createHash } from "crypto";
import appConfig from "../common/app-config";
import { InvalidArgumentError } from "../common/errors";
import { getFileSrc } from "../common/utilities";
import { CollectionSummary } from "../types/collection-summary";

export type CollectionSort = "random";

export interface BrowseCollectionsQuery {
    sort?: CollectionSort;
    /** Keeps the random order of an earlier page; derived from the Shuffle period when absent */
    seed?: string;
    /** Opaque; from the previous page's nextCursor */
    cursor?: string;
    limit?: number;
}

export interface BrowseCollectionsPage {
    collections: CollectionSummary[];
    nextCursor: string | null;
    seed: string;
}

export const DEFAULT_BROWSE_LIMIT = 48;
export const MAX_BROWSE_LIMIT = 200;

const SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SHUFFLE_KEY_PATTERN = /^[0-9a-f]{32}$/;
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a page ends in the random order: the last collection's shuffle key and id */
type RandomCursor = { shuffleKey: string; id: string };

/**
 * One page of a user's collections as summaries, in random order: by a hash of
 * the collection id and the seed, with the id as the final tie-break.
 */
export async function browseCollections(
    userId: string,
    now: Date,
    query: BrowseCollectionsQuery
): Promise<BrowseCollectionsPage> {
    const sort = query.sort ?? "random";
    if (sort !== "random") {
        throw new InvalidArgumentError(`Unknown sort '${sort}'`);
    }
    const limit = query.limit ?? DEFAULT_BROWSE_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BROWSE_LIMIT) {
        throw new InvalidArgumentError(
            `Limit must be a whole number from 1 to ${MAX_BROWSE_LIMIT}`
        );
    }
    if (query.seed !== undefined && !SEED_PATTERN.test(query.seed)) {
        throw new InvalidArgumentError("Malformed seed");
    }
    const seed = query.seed ?? deriveShuffleSeed(userId, now);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const db = await Database.getInstance();
    // "C" collation: hex keys compare byte by byte, the same in ORDER BY and the cursor
    const shuffleKey = `md5(c.id::text || :seed) COLLATE "C"`;
    const rows = (await db.select(
        `SELECT c.id, c.name, c."createdAt", ${shuffleKey} AS "shuffleKey"
            FROM "Collections" c
            WHERE c."UserId" = :userId
            ${
                after
                    ? `AND (${shuffleKey}, c.id) > (:afterKey COLLATE "C", CAST(:afterId AS uuid))`
                    : ""
            }
            ORDER BY "shuffleKey", c.id
            LIMIT :limit`,
        {
            userId,
            seed,
            afterKey: after?.shuffleKey,
            afterId: after?.id,
            // One extra row tells whether another page follows
            limit: limit + 1
        }
    )) as { id: string; name: string; createdAt: Date; shuffleKey: string }[];

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    const nextCursor =
        rows.length > limit && last
            ? encodeCursor({ shuffleKey: last.shuffleKey, id: last.id })
            : null;

    return {
        collections: await summarize(pageRows),
        nextCursor,
        seed
    };
}

/**
 * The seed of a user's random order during the Shuffle period that `now` falls in:
 * the same for the whole period, and different for every user and every period.
 */
export function deriveShuffleSeed(userId: string, now: Date) {
    const periodMs = Math.max(1, appConfig.shufflePeriodMinutes) * 60_000;
    const periodIndex = Math.floor(now.getTime() / periodMs);
    return createHash("sha256")
        .update(`${userId}:${periodIndex}`)
        .digest("hex")
        .slice(0, 16);
}

async function summarize(
    collections: { id: string; name: string; createdAt: Date }[]
): Promise<CollectionSummary[]> {
    if (collections.length === 0) {
        return [];
    }
    const db = await Database.getInstance();
    const ids = collections.map((collection) => collection.id);

    const [aggregates, thumbnails, tags] = await Promise.all([
        db.select(
            `SELECT f."CollectionId" AS "collectionId",
                    count(*) FILTER (WHERE f."mimeType" LIKE 'image%')::int AS "imageCount",
                    count(*) FILTER (WHERE f."mimeType" LIKE 'video%')::int AS "videoCount",
                    max(f."createdAt") AS "lastFileCreatedAt"
                FROM "CollectionFiles" f
                WHERE f."CollectionId" IN (:ids)
                GROUP BY f."CollectionId"`,
            { ids }
        ) as Promise<
            {
                collectionId: string;
                imageCount: number;
                videoCount: number;
                lastFileCreatedAt: Date;
            }[]
        >,
        // The first file by name is the Cover, so it leads the thumbnails
        db.select(
            `SELECT c.id AS "collectionId", t.id, t."mimeType",
                    CASE WHEN t.position = 1 THEN t."blurDataUrl" END AS "blurDataUrl"
                FROM "Collections" c
                CROSS JOIN LATERAL (
                    SELECT f.id, f."mimeType", f."blurDataUrl",
                           row_number() OVER (ORDER BY f.name, f.id) AS position
                        FROM "CollectionFiles" f
                        WHERE f."CollectionId" = c.id
                        ORDER BY f.name, f.id
                        LIMIT :thumbnailsLimit
                ) t
                WHERE c.id IN (:ids)
                ORDER BY c.id, t.position`,
            { ids, thumbnailsLimit: Collection.thumbnailsLimit }
        ) as Promise<
            {
                collectionId: string;
                id: string;
                mimeType: string;
                blurDataUrl: string | null;
            }[]
        >,
        db.select(
            `SELECT ct."CollectionId" AS "collectionId", ct."TagName" AS name
                FROM "CollectionTags" ct
                WHERE ct."CollectionId" IN (:ids)
                ORDER BY ct."TagName"`,
            { ids }
        ) as Promise<{ collectionId: string; name: string }[]>
    ]);

    return collections.map((collection) => {
        const counts = aggregates.find(
            (row) => row.collectionId === collection.id
        );
        const files = thumbnails.filter(
            (row) => row.collectionId === collection.id
        );
        const thumbnailSrcs = files.map((file) =>
            getFileSrc({
                collectionId: collection.id,
                fileId: file.id,
                mimeType: file.mimeType,
                thumbnail: true
            })
        );
        return {
            id: collection.id,
            name: collection.name,
            tags: tags
                .filter((tag) => tag.collectionId === collection.id)
                .map((tag) => tag.name),
            imageCount: counts?.imageCount ?? 0,
            videoCount: counts?.videoCount ?? 0,
            thumbnails: thumbnailSrcs,
            cover:
                files.length > 0
                    ? {
                          thumbnailSrc: thumbnailSrcs[0],
                          blurDataUrl: files[0].blurDataUrl
                      }
                    : null,
            lastAddedTo: new Date(
                counts?.lastFileCreatedAt ?? collection.createdAt
            ).getTime()
        };
    });
}

function encodeCursor(cursor: RandomCursor) {
    return Buffer.from(JSON.stringify([cursor.shuffleKey, cursor.id])).toString(
        "base64url"
    );
}

function decodeCursor(cursor: string): RandomCursor {
    try {
        const [shuffleKey, id] = JSON.parse(
            Buffer.from(cursor, "base64url").toString("utf8")
        );
        if (SHUFFLE_KEY_PATTERN.test(shuffleKey) && UUID_PATTERN.test(id)) {
            return { shuffleKey, id };
        }
    } catch {
        // Falls through to the error below
    }
    throw new InvalidArgumentError("Malformed cursor");
}

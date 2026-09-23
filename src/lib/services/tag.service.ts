import Database from "@/db/Database";
import { QueryTypes } from "sequelize";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import { BulkTagChanges, TagsById } from "../types/bulk-tag";
import { TAG_SCOPES, TagCount, TagScope } from "../types/tag-count";
import { UUID_PATTERN } from "./keyset-paging";

export type { BulkTagChanges, TagsById } from "../types/bulk-tag";
export type { TagCount, TagScope } from "../types/tag-count";

export interface CountTagsQuery {
    scope: TagScope;
    /** With the files scope: count only the files of this collection */
    collectionId?: string;
}

/** The editors' limit on a tag's length */
const TAG_MAX_LENGTH = 50;

/** The tags trimmed, once each ignoring case; rejects empty and overlong ones */
function tagNames(tags: string[]) {
    const names = new Map<string, string>();
    for (const tag of tags) {
        const name = tag.trim();
        if (name.length === 0 || name.length > TAG_MAX_LENGTH) {
            throw new InvalidArgumentError(
                `Tags must be 1 to ${TAG_MAX_LENGTH} characters long`
            );
        }
        names.set(name.toLowerCase(), names.get(name.toLowerCase()) ?? name);
    }
    return Array.from(names.values());
}

/** Where each target's tags are, and which of the ids are the user's own */
const TAGGED: Record<
    TagScope,
    { junction: string; itemColumn: string; owned: string }
> = {
    collections: {
        junction: "CollectionTags",
        itemColumn: "CollectionId",
        owned: `SELECT c.id FROM "Collections" c
            WHERE c.id IN (:ids) AND c."UserId" = :userId`
    },
    files: {
        junction: "CollectionFileTags",
        itemColumn: "CollectionFileId",
        owned: `SELECT f.id FROM "CollectionFiles" f
            JOIN "Collections" c ON c.id = f."CollectionId"
            WHERE f.id IN (:ids) AND c."UserId" = :userId`
    }
};

export default class TagService {
    constructor(private readonly userId: string) {}

    /**
     * The tags of the user's collections or files, with how many of them have
     * each tag: most used first, then by name ignoring case.
     */
    async countTags(query: CountTagsQuery): Promise<TagCount[]> {
        const { scope, collectionId } = query;
        if (!TAG_SCOPES.includes(scope)) {
            throw new InvalidArgumentError(`Unknown scope '${scope}'`);
        }
        if (collectionId !== undefined && scope !== "files") {
            throw new InvalidArgumentError(
                "Only file tags are counted within a collection"
            );
        }
        if (collectionId !== undefined) {
            await this.throwIfNotUserCollection(collectionId);
        }

        const db = await Database.getInstance();
        const tagged =
            scope === "collections"
                ? `SELECT ct."TagName" AS name
                    FROM "CollectionTags" ct
                    JOIN "Collections" c ON c.id = ct."CollectionId"
                    WHERE c."UserId" = :userId`
                : `SELECT ft."TagName" AS name
                    FROM "CollectionFileTags" ft
                    JOIN "CollectionFiles" f ON f.id = ft."CollectionFileId"
                    JOIN "Collections" c ON c.id = f."CollectionId"
                    WHERE c."UserId" = :userId
                    ${collectionId ? `AND c.id = :collectionId` : ""}`;
        // Each tag is named as in the Tags table, whatever case its uses have.
        // Names equal ignoring case cannot both be tags, so the ties end there.
        const rows = (await db.select(
            `SELECT tag.name, count(*)::int AS count
                FROM (${tagged}) tagged
                JOIN "Tags" tag ON tag.name = tagged.name
                GROUP BY tag.name
                ORDER BY count DESC, tag.name`,
            { userId: this.userId, collectionId }
        )) as TagCount[];
        return rows.map(({ name, count }) => ({ name, count }));
    }

    /**
     * Adds and removes tags on every one of the user's collections, or files,
     * in the selection, all at once. Returns each one's tags afterwards.
     */
    async bulkTag(changes: BulkTagChanges): Promise<TagsById> {
        const { target } = changes;
        if (!TAG_SCOPES.includes(target)) {
            throw new InvalidArgumentError(`Unknown target '${target}'`);
        }
        const ids = Array.from(new Set(changes.ids));
        if (ids.length === 0) {
            throw new InvalidArgumentError("Nothing to tag");
        }
        const add = tagNames(changes.add);
        const remove = tagNames(changes.remove);
        const removed = new Set(remove.map((tag) => tag.toLowerCase()));
        if (add.some((tag) => removed.has(tag.toLowerCase()))) {
            throw new InvalidArgumentError(
                "A tag cannot be both added and removed"
            );
        }
        const { junction, itemColumn, owned } = TAGGED[target];
        // Another user's, or none at all: the same to the user
        const notFound = new NotFoundError(`Some of the ${target} were not found`);
        if (!ids.every((id) => UUID_PATTERN.test(id))) {
            throw notFound;
        }
        const replacements = { ids, add, remove, userId: this.userId };
        const db = await Database.getInstance();
        const sequelize = db.models.Tag.sequelize!;
        const transaction = await db.transaction();
        try {
            // All or nothing: one id that is not the user's rejects them all
            const [{ count }] = (await sequelize.query(
                `SELECT count(*)::int AS count FROM (${owned}) owned`,
                { replacements, transaction, type: QueryTypes.SELECT }
            )) as { count: number }[];
            if (count !== ids.length) {
                throw notFound;
            }
            if (add.length > 0) {
                await db.models.Tag.bulkCreate(
                    add.map((name) => ({ name })),
                    { ignoreDuplicates: true, returning: false, transaction }
                );
                await sequelize.query(
                    `INSERT INTO "${junction}" ("${itemColumn}", "TagName", "createdAt", "updatedAt")
                        SELECT owned.id, tag.name, now(), now()
                        FROM (${owned}) owned, "Tags" tag
                        WHERE tag.name IN (:add)
                        ON CONFLICT DO NOTHING`,
                    { replacements, transaction }
                );
            }
            if (remove.length > 0) {
                await sequelize.query(
                    `DELETE FROM "${junction}"
                        WHERE "${itemColumn}" IN (${owned})
                        AND "TagName" IN (:remove)`,
                    { replacements, transaction }
                );
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        const rows = (await db.select(
            `SELECT "${itemColumn}" AS id, "TagName" AS name
                FROM "${junction}"
                WHERE "${itemColumn}" IN (${owned})`,
            replacements
        )) as { id: string; name: string }[];
        const tagsById: TagsById = Object.fromEntries(ids.map((id) => [id, []]));
        rows.forEach(({ id, name }) => tagsById[id].push(name));
        Object.values(tagsById).forEach((tags) =>
            tags.sort((a, b) => a.localeCompare(b))
        );
        return tagsById;
    }

    private async throwIfNotUserCollection(collectionId: string) {
        const notFound = new NotFoundError(
            `Collection not found '${collectionId}'`
        );
        if (!UUID_PATTERN.test(collectionId)) {
            throw notFound;
        }
        const db = await Database.getInstance();
        const collection = await db.models.Collection.findByPk(collectionId, {
            attributes: ["UserId"],
            raw: true
        });
        if (!collection || collection.UserId !== this.userId) {
            throw notFound;
        }
    }
}

import Database from "@/db/Database";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import { TAG_SCOPES, TagCount, TagScope } from "../types/tag-count";
import { UUID_PATTERN } from "./keyset-paging";

export type { TagCount, TagScope } from "../types/tag-count";

export interface CountTagsQuery {
    scope: TagScope;
    /** With the files scope: count only the files of this collection */
    collectionId?: string;
}

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

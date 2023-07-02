import Database from "@/db/Database";
import { Collection } from "../interfaces/collection";

interface CreateResult {
    collection?: Collection;
    error?: string;
}

interface GetResult {
    collection?: Collection;
    notFound?: boolean;
}

interface UpdateResult {
    collection?: Collection;
    notFound?: boolean;
    error?: string;
}

interface DeleteResult {
    error?: string;
}

export class CollectionService {
    constructor(private readonly userId: number) {}

    async update(collection: Collection): Promise<UpdateResult> {
        if (!collection.id) {
            return { notFound: true };
        }
        if (!collection.name) {
            return { error: "Invalid collection name" };
        }
        if (await this.nameTaken(collection.name, collection.id)) {
            return { error: "Collection name already exists" };
        }
        const updatedCollection = await Database.sqlOne(
            `UPDATE collections
            SET label = $1, updated_at = $2
            WHERE id = $3 AND user_id = $4
            RETURNING id, label, created_at, updated_at`,
            [collection.name, new Date(), collection.id, this.userId]
        );
        if (!updatedCollection) {
            return { notFound: true };
        }
        let tags: string[];
        if (collection.tags.length > 0) {
            tags = await this.setTags(updatedCollection.id, collection.tags);
        } else {
            tags = await this.getTags(updatedCollection.id);
        }
        return {
            collection: {
                id: updatedCollection.id,
                name: updatedCollection.label,
                tags: tags,
                createdAt: updatedCollection.created_at.getTime(),
                updatedAt: updatedCollection.updated_at.getTime()
            }
        };
    }

    async delete(collectionId: number): Promise<DeleteResult> {
        if (isNaN(collectionId)) {
            return { error: `Invalid collection id '${collectionId}'` };
        }
        await Database.sqlOne(
            "DELETE FROM collections WHERE user_id = $1 AND id = $2",
            [this.userId, collectionId]
        );
        return {};
    }

    async create(name: string, tags: string): Promise<CreateResult> {
        if (!name) {
            return { error: "Invalid collection name" };
        }
        if (!Array.isArray(tags)) {
            return { error: "Invalid collection tags" };
        }

        if (await this.nameTaken(name)) {
            return { error: "Collection name already exists" };
        }

        const collection = await Database.sqlOne(
            "INSERT INTO collections(user_id, label) VALUES ($1, $2) RETURNING *",
            [this.userId, name]
        );
        const insertedTags = await this.setTags(collection.id, tags);

        return {
            collection: {
                id: collection.id,
                name: collection.label,
                tags: insertedTags,
                createdAt: collection.created_at.getTime(),
                updatedAt: collection.updated_at.getTime()
            }
        };
    }

    async get(collectionId: number): Promise<GetResult> {
        if (isNaN(collectionId)) {
            return { notFound: true };
        }
        const result = await Database.sql(
            `SELECT c.id, c.label as collection_label, c.created_at. c.updated_at, ct.label as tag_label
            FROM collections c
            LEFT JOIN collection_tags ct ON c.id = ct.collection_id
            WHERE c.user_id = $1 AND c.id = $2`,
            [this.userId, collectionId]
        );
        if (result.length === 0) {
            return { notFound: true };
        }
        const collection: Collection = {
            id: result[0].id,
            name: result[0].collection_label,
            createdAt: result[0].created_at.getTime(),
            updatedAt: result[0].updated_at.getTime(),
            tags: result.map((row) => row.tag_label)
        };
        return {
            collection
        };
    }

    async getAll() {
        const result = await Database.sql(
            `SELECT c.id, c.label as collection_label, c.created_at, c.updated_at, ct.label as tag_label
            FROM collections c
            LEFT JOIN collection_tags ct ON c.id = ct.collection_id
            WHERE c.user_id = $1`,
            [this.userId]
        );

        const collectionsById: Record<number, Collection> = result.reduce(
            (acc: Record<number, Collection>, curr) => {
                const {
                    id,
                    collection_label,
                    created_at,
                    updated_at,
                    tag_label
                } = curr;
                acc[id] = {
                    id: id,
                    name: collection_label,
                    tags: acc[id]?.tags ?? [],
                    createdAt: created_at.getTime(),
                    updatedAt: updated_at.getTime()
                };
                if (tag_label) {
                    acc[id].tags.push(tag_label);
                }
                return acc;
            },
            {}
        );

        return Object.values(collectionsById);
    }

    private async nameTaken(name: string, collectionId?: number) {
        let existing: any[];
        if (collectionId) {
            existing = await Database.sql(
                "SELECT id FROM collections WHERE user_id = $1 AND id != $2 AND label = $3 LIMIT 1",
                [this.userId, collectionId, name.trim()]
            );
        } else {
            existing = await Database.sql(
                "SELECT id FROM collections WHERE user_id = $1 AND label = $2 LIMIT 1",
                [this.userId, name.trim()]
            );
        }
        return existing.length > 0;
    }

    private async getTags(collectionId: number) {
        const result = await Database.sql(
            `SELECT ct.label as tag_label
            FROM collections c
            LEFT JOIN collection_tags ct ON c.id = ct.collection_id
            WHERE c.user_id = $1 AND c.id = $2`,
            [this.userId, collectionId]
        );
        return result.map(({ tag_label }) => tag_label);
    }

    private async setTags(
        collectionId: number,
        tags: string[]
    ): Promise<string[]> {
        if (tags.length === 0) {
            return [];
        }
        await this.deleteAllTags(collectionId);
        const tagRows = tags.map((tag) => ({
            collection_id: collectionId,
            label: tag
        }));
        const insertedTags = await Database.bulkInsert(
            "collection_tags",
            tagRows,
            ["collection_id", "label"],
            ["label"]
        );
        return insertedTags.map(({ label }) => label);
    }

    private async deleteAllTags(collectionId: number) {
        await Database.sql(
            `DELETE from collection_tags WHERE collection_id = $1`,
            [collectionId]
        );
    }
}

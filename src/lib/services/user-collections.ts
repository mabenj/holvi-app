import Database from "@/db/Database";
import { NotFoundError } from "../common/errors";
import { UUID_PATTERN } from "./keyset-paging";

/**
 * Throws NotFoundError unless the collection exists and is the user's. To the
 * user, another user's collection is the same as none at all.
 */
export async function throwIfNotUserCollection(
    userId: string,
    collectionId: string
) {
    const notFound = new NotFoundError(`Collection not found '${collectionId}'`);
    if (!UUID_PATTERN.test(collectionId)) {
        throw notFound;
    }
    const db = await Database.getInstance();
    const collection = await db.models.Collection.findByPk(collectionId, {
        attributes: ["UserId"],
        raw: true
    });
    if (!collection || collection.UserId !== userId) {
        throw notFound;
    }
}

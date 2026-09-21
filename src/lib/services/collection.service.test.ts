import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import { addFile, createCollection, createUser } from "../../../test/fixtures";
import { CollectionService } from "./collection.service";

describe("CollectionService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("reports a collection's creation time", async () => {
        const user = await createUser("alice");
        const createdAt = new Date("2019-05-04T10:00:00Z");
        const holiday = await createCollection(user.id, "Holiday", {
            createdAt
        });

        const collection = await new CollectionService(user.id).getCollection(
            holiday.id
        );

        expect(collection.timestamp).toBe(createdAt.getTime());
    });

    it("dates a file by its taken-at time, falling back to its creation time", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        await addFile(user.id, holiday.id, "scanned.jpg", Buffer.from("a"), {
            createdAt: new Date("2022-01-01T00:00:00Z")
        });
        await addFile(user.id, holiday.id, "beach.jpg", Buffer.from("b"), {
            createdAt: new Date("2022-01-02T00:00:00Z"),
            takenAt: new Date("2015-07-01T12:00:00Z")
        });

        const files = await new CollectionService(user.id).getFiles(holiday.id);

        expect(
            Object.fromEntries(
                files.map((file) => [file.name, new Date(file.timestamp)])
            )
        ).toEqual({
            "scanned.jpg": new Date("2022-01-01T00:00:00Z"),
            "beach.jpg": new Date("2015-07-01T12:00:00Z")
        });
    });
});

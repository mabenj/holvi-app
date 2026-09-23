import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import {
    addFile,
    createCollection,
    createUser
} from "../../../test/fixtures";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import TagService, { TagScope } from "./tag.service";

describe("Counting tags (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("counts collection tags by how many collections use them, then by name ignoring case", async () => {
        const user = await createUser("alice");
        await createCollection(user.id, "Beach", {
            tags: ["travel", "summer", "Banana"]
        });
        await createCollection(user.id, "Alps", {
            tags: ["travel", "winter", "apple"]
        });
        await createCollection(user.id, "Garden", { tags: ["summer"] });
        await createCollection(user.id, "Trip", { tags: ["travel"] });
        const trip = await createCollection(user.id, "Untagged");
        // File tags are not collection tags
        await addFile(user.id, trip.id, "a.jpg", Buffer.from("a"), {
            tags: ["travel", "sunset"]
        });

        const tags = await new TagService(user.id).countTags({
            scope: "collections"
        });

        expect(tags).toEqual([
            { name: "travel", count: 3 },
            { name: "summer", count: 2 },
            { name: "apple", count: 1 },
            { name: "Banana", count: 1 },
            { name: "winter", count: 1 }
        ]);
    });

    it("counts file tags across the user's files, or within one collection", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip", {
            tags: ["travel"]
        });
        const home = await createCollection(user.id, "Home");
        const files: [string, string, string[]][] = [
            [trip.id, "a.jpg", ["sunset", "beach"]],
            [trip.id, "b.jpg", ["sunset"]],
            [trip.id, "c.jpg", ["beach"]],
            [trip.id, "d.jpg", ["sunset", "family"]],
            [home.id, "e.jpg", ["family"]],
            [home.id, "f.jpg", ["family", "cat"]]
        ];
        for (const [collectionId, name, tags] of files) {
            await addFile(user.id, collectionId, name, Buffer.from(name), {
                tags
            });
        }
        const service = new TagService(user.id);

        expect(await service.countTags({ scope: "files" })).toEqual([
            { name: "family", count: 3 },
            { name: "sunset", count: 3 },
            { name: "beach", count: 2 },
            { name: "cat", count: 1 }
        ]);
        expect(
            await service.countTags({ scope: "files", collectionId: trip.id })
        ).toEqual([
            { name: "sunset", count: 3 },
            { name: "beach", count: 2 },
            { name: "family", count: 1 }
        ]);
    });

    it("counts only the requesting user's tags", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const alices = await createCollection(alice.id, "Holiday", {
            tags: ["travel"]
        });
        await addFile(alice.id, alices.id, "a.jpg", Buffer.from("a"), {
            tags: ["sunset"]
        });
        const bobs = await createCollection(bob.id, "Secrets", {
            tags: ["travel", "secret"]
        });
        await addFile(bob.id, bobs.id, "b.jpg", Buffer.from("b"), {
            tags: ["sunset", "secret"]
        });
        const service = new TagService(alice.id);

        expect(await service.countTags({ scope: "collections" })).toEqual([
            { name: "travel", count: 1 }
        ]);
        expect(await service.countTags({ scope: "files" })).toEqual([
            { name: "sunset", count: 1 }
        ]);
        await expect(
            service.countTags({ scope: "files", collectionId: bobs.id })
        ).rejects.toThrow(NotFoundError);
    });

    it("rejects an unknown scope, and a collection with collection tags", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const service = new TagService(user.id);

        await expect(
            service.countTags({ scope: "people" as TagScope })
        ).rejects.toThrow(InvalidArgumentError);
        await expect(
            service.countTags({ scope: "collections", collectionId: trip.id })
        ).rejects.toThrow(InvalidArgumentError);
    });
});

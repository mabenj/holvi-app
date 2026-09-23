import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import {
    addFile,
    createCollection,
    createUser
} from "../../../test/fixtures";
import { InvalidArgumentError, NotFoundError } from "../common/errors";
import { CollectionService } from "./collection.service";
import TagService, { BulkTagChanges, TagScope } from "./tag.service";

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

describe("Bulk tagging (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    /** Each of the user's collections' tags as the Collections tab shows them, by name */
    async function collectionTags(userId: string) {
        const { collections } = await new CollectionService(
            userId
        ).browseCollections({ limit: 200 });
        return Object.fromEntries(
            collections.map((c) => [c.name, [...c.tags].sort()])
        );
    }

    it("adds tags to every selected collection and returns each one's tags", async () => {
        const user = await createUser("alice");
        const beach = await createCollection(user.id, "Beach", {
            tags: ["summer"]
        });
        const alps = await createCollection(user.id, "Alps");
        await createCollection(user.id, "Garden", { tags: ["summer"] });

        const updated = await new TagService(user.id).bulkTag({
            target: "collections",
            ids: [beach.id, alps.id],
            add: ["travel", "2024"],
            remove: []
        });

        expect(updated).toEqual({
            [beach.id]: ["2024", "summer", "travel"],
            [alps.id]: ["2024", "travel"]
        });
        expect(await collectionTags(user.id)).toEqual({
            Alps: ["2024", "travel"],
            Beach: ["2024", "summer", "travel"],
            Garden: ["summer"]
        });
    });

    /** Each file's tags in a collection as its page shows them, by name */
    async function fileTags(userId: string, collectionId: string) {
        const { files } = await new CollectionService(userId).browseFiles(
            collectionId,
            { limit: 200 }
        );
        return Object.fromEntries(
            files.map((f) => [f.name, [...f.tags].sort()])
        );
    }

    it("adds and removes tags across files of different collections", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const home = await createCollection(user.id, "Home");
        const a = await addFile(user.id, trip.id, "a.jpg", Buffer.from("a"), {
            tags: ["sunset", "blurry"]
        });
        const b = await addFile(user.id, trip.id, "b.jpg", Buffer.from("b"), {
            tags: ["blurry"]
        });
        await addFile(user.id, trip.id, "c.jpg", Buffer.from("c"), {
            tags: ["blurry"]
        });
        const d = await addFile(user.id, home.id, "d.jpg", Buffer.from("d"));

        const updated = await new TagService(user.id).bulkTag({
            target: "files",
            ids: [a.id, b.id, d.id],
            add: ["favourite"],
            remove: ["blurry"]
        });

        expect(updated).toEqual({
            [a.id]: ["favourite", "sunset"],
            [b.id]: ["favourite"],
            [d.id]: ["favourite"]
        });
        expect(await fileTags(user.id, trip.id)).toEqual({
            "a.jpg": ["favourite", "sunset"],
            "b.jpg": ["favourite"],
            "c.jpg": ["blurry"]
        });
        expect(await fileTags(user.id, home.id)).toEqual({
            "d.jpg": ["favourite"]
        });
    });

    it("never changes another user's collections, and changes none of the user's own when the selection includes one", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const alices = await createCollection(alice.id, "Holiday", {
            tags: ["travel"]
        });
        const bobs = await createCollection(bob.id, "Secrets", {
            tags: ["travel"]
        });
        const service = new TagService(alice.id);

        for (const ids of [[bobs.id], [alices.id, bobs.id]]) {
            await expect(
                service.bulkTag({
                    target: "collections",
                    ids,
                    add: ["hacked"],
                    remove: ["travel"]
                })
            ).rejects.toThrow(NotFoundError);
        }

        expect(await collectionTags(alice.id)).toEqual({
            Holiday: ["travel"]
        });
        expect(await collectionTags(bob.id)).toEqual({ Secrets: ["travel"] });
    });

    it("never changes another user's files, and changes none of the user's own when the selection includes one", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const alices = await createCollection(alice.id, "Holiday");
        const bobs = await createCollection(bob.id, "Secrets");
        const own = await addFile(alice.id, alices.id, "a.jpg", Buffer.from("a"), {
            tags: ["sunset"]
        });
        const other = await addFile(bob.id, bobs.id, "b.jpg", Buffer.from("b"), {
            tags: ["sunset"]
        });
        const service = new TagService(alice.id);

        for (const ids of [[other.id], [own.id, other.id]]) {
            await expect(
                service.bulkTag({
                    target: "files",
                    ids,
                    add: ["hacked"],
                    remove: ["sunset"]
                })
            ).rejects.toThrow(NotFoundError);
        }
        // A collection's id is not a file's, and the other way round
        await expect(
            service.bulkTag({
                target: "files",
                ids: [alices.id],
                add: ["hacked"],
                remove: []
            })
        ).rejects.toThrow(NotFoundError);

        expect(await fileTags(alice.id, alices.id)).toEqual({
            "a.jpg": ["sunset"]
        });
        expect(await fileTags(bob.id, bobs.id)).toEqual({ "b.jpg": ["sunset"] });
        expect(await service.countTags({ scope: "files" })).toEqual([
            { name: "sunset", count: 1 }
        ]);
    });

    it("treats tags that differ only in case as the same tag", async () => {
        const user = await createUser("alice");
        const beach = await createCollection(user.id, "Beach", {
            tags: ["Travel", "summer"]
        });
        const alps = await createCollection(user.id, "Alps");
        const service = new TagService(user.id);

        expect(
            await service.bulkTag({
                target: "collections",
                ids: [beach.id, alps.id],
                add: [" travel "],
                remove: []
            })
        ).toEqual({
            [beach.id]: ["summer", "Travel"],
            [alps.id]: ["Travel"]
        });
        expect(
            await service.bulkTag({
                target: "collections",
                ids: [beach.id, alps.id],
                add: [],
                remove: ["SUMMER", "travel"]
            })
        ).toEqual({ [beach.id]: [], [alps.id]: [] });
    });

    it("rejects an empty selection, a tag both added and removed, and tags of the wrong length, changing nothing", async () => {
        const user = await createUser("alice");
        const beach = await createCollection(user.id, "Beach", {
            tags: ["summer"]
        });
        const service = new TagService(user.id);
        const rejected: Omit<BulkTagChanges, "target">[] = [
            { ids: [], add: ["travel"], remove: [] },
            { ids: [beach.id], add: ["travel", "Summer"], remove: ["summer"] },
            { ids: [beach.id], add: ["travel", "  "], remove: [] },
            { ids: [beach.id], add: ["x".repeat(51)], remove: [] }
        ];

        for (const changes of rejected) {
            await expect(
                service.bulkTag({ target: "collections", ...changes })
            ).rejects.toThrow(InvalidArgumentError);
        }
        await expect(
            service.bulkTag({
                target: "people" as TagScope,
                ids: [beach.id],
                add: ["travel"],
                remove: []
            })
        ).rejects.toThrow(InvalidArgumentError);

        expect(await collectionTags(user.id)).toEqual({ Beach: ["summer"] });
    });
});

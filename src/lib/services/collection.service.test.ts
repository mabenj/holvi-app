import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import { addFile, createCollection, createUser } from "../../../test/fixtures";
import {
    BrowseCollectionsPage,
    BrowseCollectionsQuery,
    CollectionService
} from "./collection.service";

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

describe("Browsing collections (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("pages concatenated through cursors contain every collection exactly once", async () => {
        const user = await createUser("alice");
        const names = Array.from({ length: 11 }, (_, i) => `Collection ${i}`);
        for (const name of names) {
            await createCollection(user.id, name);
        }

        const pages = await browseAllPages(new CollectionService(user.id), {
            limit: 4
        });

        expect(pages.map((page) => page.collections.length)).toEqual([4, 4, 3]);
        expect(pages.at(-1)!.nextCursor).toBeNull();
        expect(
            pages.flatMap((page) => page.collections.map((c) => c.name)).sort()
        ).toEqual([...names].sort());
    });

    it("keeps one random order for a Shuffle period and changes it in the next", async () => {
        const user = await createUser("alice");
        await createCollections(user.id, 12);
        let now = new Date("2026-03-01T10:05:00Z");
        const service = new CollectionService(user.id, { clock: () => now });

        const early = await browseAllNames(service, { limit: 5 });
        now = new Date("2026-03-01T10:55:00Z");
        const late = await browseAllNames(service, { limit: 5 });
        now = new Date("2026-03-01T11:05:00Z");
        const nextPeriod = await browseAllNames(service, { limit: 5 });

        expect(late).toEqual(early);
        expect(nextPeriod).not.toEqual(early);
        expect([...nextPeriod].sort()).toEqual([...early].sort());
    });

    it("keeps a previous Shuffle period's order when its seed is passed", async () => {
        const user = await createUser("alice");
        await createCollections(user.id, 12);
        let now = new Date("2026-03-01T10:50:00Z");
        const service = new CollectionService(user.id, { clock: () => now });
        const wholeOrder = await browseAllNames(service, { limit: 12 });

        const firstPage = await service.browseCollections({ limit: 5 });
        now = new Date("2026-03-01T11:10:00Z");
        const rest = await browseAllPages(service, {
            limit: 5,
            seed: firstPage.seed,
            cursor: firstPage.nextCursor!
        });

        expect(rest.every((page) => page.seed === firstPage.seed)).toBe(true);
        expect(
            [firstPage, ...rest].flatMap((page) =>
                page.collections.map((c) => c.name)
            )
        ).toEqual(wholeOrder);
        // Without the seed, the new period brings its own order
        expect(await browseAllNames(service, { limit: 12 })).not.toEqual(
            wholeOrder
        );
    });

    it("derives different seeds for different users", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const clock = () => new Date("2026-03-01T10:05:00Z");

        const alicePage = await new CollectionService(alice.id, {
            clock
        }).browseCollections();
        const bobPage = await new CollectionService(bob.id, {
            clock
        }).browseCollections();

        expect(alicePage.seed).not.toEqual(bobPage.seed);
    });

    it("tells the Shuffle period by real time when no clock is given", async () => {
        const user = await createUser("alice");
        const realTime = new CollectionService(user.id, {
            clock: () => new Date()
        });

        const before = (await realTime.browseCollections()).seed;
        const byDefault = (
            await new CollectionService(user.id).browseCollections()
        ).seed;
        const after = (await realTime.browseCollections()).seed;

        // A period can end between the calls, so either side may match
        expect([before, after]).toContain(byDefault);
        const longAgo = await new CollectionService(user.id, {
            clock: () => new Date("2001-01-01T00:00:00Z")
        }).browseCollections();
        expect(byDefault).not.toEqual(longAgo.seed);
    });

    it("summarises counts, thumbnails with the Cover first, and Last added to", async () => {
        const user = await createUser("alice");
        const createdAt = new Date("2020-01-01T00:00:00Z");
        const trip = await createCollection(user.id, "Trip", {
            createdAt,
            tags: ["travel", "family"]
        });
        const empty = await createCollection(user.id, "Empty", { createdAt });
        for (let i = 11; i >= 0; i--) {
            await addFile(
                user.id,
                trip.id,
                `photo-${String(i).padStart(2, "0")}.jpg`,
                Buffer.from(`image ${i}`),
                { createdAt: new Date(Date.UTC(2021, 1, 10 + i)) }
            );
        }
        for (const [name, mimeType] of [
            ["Clip-b.mov", "video/quicktime"],
            ["clip-a.mp4", "video/mp4"]
        ]) {
            await addFile(user.id, trip.id, name, Buffer.from(name), {
                mimeType,
                createdAt: new Date("2021-01-01T00:00:00Z")
            });
        }
        const fileIds = Object.fromEntries(
            (await new CollectionService(user.id).getFiles(trip.id)).map(
                (file) => [file.name, file.id]
            )
        );
        const thumbnail = (name: string) =>
            `/api/collections/${trip.id}/files?thumbnail=${fileIds[name]}`;

        const { collections } = await new CollectionService(
            user.id
        ).browseCollections();
        const summaries = Object.fromEntries(
            collections.map((summary) => [summary.name, summary])
        );

        expect(summaries["Trip"]).toEqual({
            id: trip.id,
            name: "Trip",
            tags: ["family", "travel"],
            imageCount: 12,
            videoCount: 2,
            // By name, ignoring case: clip-a is the Cover, then Clip-b, then the photos
            thumbnails: [
                "clip-a.mp4",
                "Clip-b.mov",
                "photo-00.jpg",
                "photo-01.jpg",
                "photo-02.jpg",
                "photo-03.jpg",
                "photo-04.jpg",
                "photo-05.jpg",
                "photo-06.jpg",
                "photo-07.jpg"
            ].map(thumbnail),
            cover: { thumbnailSrc: thumbnail("clip-a.mp4"), blurDataUrl: null },
            // The newest file, photo-11, was created on 21 February
            lastAddedTo: Date.UTC(2021, 1, 21)
        });
        expect(summaries["Empty"]).toEqual({
            id: empty.id,
            name: "Empty",
            tags: [],
            imageCount: 0,
            videoCount: 0,
            thumbnails: [],
            cover: null,
            lastAddedTo: createdAt.getTime()
        });
    });

    it("includes only the Cover's blur placeholder", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        await addFile(user.id, trip.id, "b.jpg", Buffer.from("b"), {
            blurDataUrl: "data:image/png;base64,bbb"
        });
        await addFile(user.id, trip.id, "A.jpg", Buffer.from("a"), {
            blurDataUrl: "data:image/png;base64,aaa"
        });

        const {
            collections: [summary]
        } = await new CollectionService(user.id).browseCollections();

        expect(summary.cover?.blurDataUrl).toBe("data:image/png;base64,aaa");
        expect(JSON.stringify(summary)).not.toContain("bbb");
    });

    it("browses only the requesting user's collections", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        await createCollection(alice.id, "Holiday");
        const bobs = await createCollection(bob.id, "Secrets");
        await addFile(bob.id, bobs.id, "secret.jpg", Buffer.from("s"));

        const names = await browseAllNames(new CollectionService(alice.id), {
            limit: 1
        });

        expect(names).toEqual(["Holiday"]);
    });

    it("rejects a malformed cursor", async () => {
        const user = await createUser("alice");

        await expect(
            new CollectionService(user.id).browseCollections({
                cursor: "not-a-cursor"
            })
        ).rejects.toThrow("Malformed cursor");
    });
});

async function createCollections(userId: string, count: number) {
    for (let i = 0; i < count; i++) {
        await createCollection(userId, `Collection ${i}`);
    }
}

/** Names of every collection a browse returns, in order, across all pages */
async function browseAllNames(
    service: CollectionService,
    query: BrowseCollectionsQuery
) {
    const pages = await browseAllPages(service, query);
    return pages.flatMap((page) => page.collections.map((c) => c.name));
}

/** Every page of a browse, following the cursors until the last page */
async function browseAllPages(
    service: CollectionService,
    query: BrowseCollectionsQuery
) {
    const pages: BrowseCollectionsPage[] = [];
    let cursor: string | undefined = query.cursor;
    let seed: string | undefined = query.seed;
    do {
        const page = await service.browseCollections({ ...query, seed, cursor });
        pages.push(page);
        seed = page.seed;
        cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return pages;
}

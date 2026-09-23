import appConfig from "@/lib/common/app-config";
import { existsSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import {
    addFile,
    createCollection,
    createUser,
    FileMetadata
} from "../../../test/fixtures";
import { pngImage, uploadRequest } from "../../../test/upload-fixtures";
import { NotFoundError } from "../common/errors";
import {
    BrowseCollectionsPage,
    BrowseCollectionsQuery,
    BrowseFilesPage,
    BrowseFilesQuery,
    CollectionService,
    FileSort
} from "./collection.service";

describe("CollectionService (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("serves a collection's description, tags and Cover", async () => {
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday", {
            description: "See https://example.com",
            tags: ["travel"]
        });
        const cover = await addFile(
            user.id,
            holiday.id,
            "a.jpg",
            Buffer.from("a"),
            { blurDataUrl: "data:image/png;base64,aaa" }
        );
        await addFile(user.id, holiday.id, "b.jpg", Buffer.from("b"));

        const collection = await new CollectionService(user.id).getCollection(
            holiday.id
        );

        expect(collection).toMatchObject({
            id: holiday.id,
            name: "Holiday",
            description: "See https://example.com",
            tags: ["travel"],
            imageCount: 2,
            videoCount: 0,
            cover: {
                thumbnailSrc: `/api/collections/${holiday.id}/files?thumbnail=${cover.id}`,
                blurDataUrl: "data:image/png;base64,aaa"
            }
        });
    });

    it("does not serve another user's collection", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const bobs = await createCollection(bob.id, "Secrets");

        await expect(
            new CollectionService(alice.id).getCollection(bobs.id)
        ).rejects.toThrow(NotFoundError);
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
            (
                await new CollectionService(user.id).browseFiles(trip.id, {
                    limit: 100
                })
            ).files.map((file) => [file.name, file.id])
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

describe("Browsing a collection's files (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    const day = (d: number, hour = 0) => new Date(Date.UTC(2022, 0, d, hour));

    /**
     * Files dated by taken-at time or else creation time, three of them on the
     * same date. Returns the names of the three, ordered by id.
     */
    async function createDatedFiles(userId: string, collectionId: string) {
        const files: [string, FileMetadata][] = [
            // Dated by taken-at time, although created last
            ["beach.jpg", { createdAt: day(20), takenAt: day(1) }],
            // No taken-at time: dated by creation time
            ["Scan.jpg", { createdAt: day(5) }],
            // Three files on the same date: only the id orders them
            ["tie-1.jpg", { createdAt: day(10) }],
            ["tie-2.jpg", { createdAt: day(12), takenAt: day(10) }],
            ["tie-3.jpg", { createdAt: day(10) }],
            ["apple.mp4", { createdAt: day(15), mimeType: "video/mp4" }]
        ];
        const ids: Record<string, string> = {};
        for (const [name, metadata] of files) {
            const file = await addFile(
                userId,
                collectionId,
                name,
                Buffer.from(name),
                metadata
            );
            ids[name] = file.id;
        }
        return ["tie-1.jpg", "tie-2.jpg", "tie-3.jpg"].sort((a, b) =>
            compareUuids(ids[a], ids[b])
        );
    }

    it("orders files newest first by default, dated by taken-at time or else creation time, then by id", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const tiedByIdAscending = await createDatedFiles(user.id, trip.id);

        const names = await browseAllFileNames(
            new CollectionService(user.id),
            trip.id,
            {}
        );

        expect(names).toEqual([
            "apple.mp4",
            ...[...tiedByIdAscending].reverse(),
            "Scan.jpg",
            "beach.jpg"
        ]);
    });

    it("orders files oldest first, then by id", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const tiedByIdAscending = await createDatedFiles(user.id, trip.id);

        const names = await browseAllFileNames(
            new CollectionService(user.id),
            trip.id,
            { sort: "oldest" }
        );

        expect(names).toEqual([
            "beach.jpg",
            "Scan.jpg",
            ...tiedByIdAscending,
            "apple.mp4"
        ]);
    });

    it("orders files by name ignoring case, then by id", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        await createDatedFiles(user.id, trip.id);
        const sameName = [
            await addFile(user.id, trip.id, "same.jpg", Buffer.from("1")),
            await addFile(user.id, trip.id, "SAME.jpg", Buffer.from("2"))
        ]
            .map((file) => file.id)
            .sort(compareUuids);

        const files = await browseAllFiles(
            new CollectionService(user.id),
            trip.id,
            { sort: "name" }
        );

        expect(files.map((file) => file.name.toLowerCase())).toEqual([
            "apple.mp4",
            "beach.jpg",
            "same.jpg",
            "same.jpg",
            "scan.jpg",
            "tie-1.jpg",
            "tie-2.jpg",
            "tie-3.jpg"
        ]);
        expect(files.slice(2, 4).map((file) => file.id)).toEqual(sameName);
    });

    it("pages concatenated through cursors contain every file exactly once, for every sort", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const names: string[] = [];
        for (let i = 0; i < 13; i++) {
            const name = `photo-${i}.jpg`;
            names.push(name);
            // Pairs of files share a date, so pages end inside ties
            await addFile(user.id, trip.id, name, Buffer.from(name), {
                createdAt: day(1 + Math.floor(i / 2))
            });
        }
        const service = new CollectionService(user.id);

        for (const sort of ["newest", "oldest", "name"] as const) {
            const pages = await browseAllFilePages(service, trip.id, {
                sort,
                limit: 3
            });
            const whole = await service.browseFiles(trip.id, {
                sort,
                limit: 100
            });

            expect(pages.map((page) => page.files.length)).toEqual([
                3, 3, 3, 3, 1
            ]);
            expect(pages.at(-1)!.nextCursor).toBeNull();
            expect(
                pages.flatMap((page) => page.files.map((file) => file.name))
            ).toEqual(whole.files.map((file) => file.name));
            expect(whole.files.map((file) => file.name).sort()).toEqual(
                [...names].sort()
            );
        }
    });

    it("summarises a file with its date, blur placeholder and sources, and a video with its playback source", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const photo = await addFile(
            user.id,
            trip.id,
            "photo.jpg",
            Buffer.from("p"),
            {
                createdAt: day(2),
                takenAt: day(1, 12),
                width: 4000,
                height: 3000,
                thumbnailWidth: 400,
                thumbnailHeight: 300,
                blurDataUrl: "data:image/png;base64,ppp",
                tags: ["sunset"]
            }
        );
        const video = await addFile(
            user.id,
            trip.id,
            "clip.mp4",
            Buffer.from("v"),
            { mimeType: "video/mp4", createdAt: day(3), durationInSeconds: 42 }
        );

        const { files } = await new CollectionService(user.id).browseFiles(
            trip.id,
            { sort: "name" }
        );

        expect(files).toEqual([
            expect.objectContaining({
                id: video.id,
                name: "clip.mp4",
                mimeType: "video/mp4",
                timestamp: day(3).getTime(),
                durationInSeconds: 42,
                thumbnailSrc: `/api/collections/${trip.id}/files?thumbnail=${video.id}`,
                // The original, until Renditions exist
                playbackSrc: `/api/collections/${trip.id}/files?video=${video.id}`
            }),
            expect.objectContaining({
                id: photo.id,
                collectionId: trip.id,
                name: "photo.jpg",
                mimeType: "image/jpeg",
                timestamp: day(1, 12).getTime(),
                src: `/api/collections/${trip.id}/files?image=${photo.id}`,
                thumbnailSrc: `/api/collections/${trip.id}/files?thumbnail=${photo.id}`,
                width: 4000,
                height: 3000,
                thumbnailWidth: 400,
                thumbnailHeight: 300,
                blurDataUrl: "data:image/png;base64,ppp",
                tags: ["sunset"]
            })
        ]);
        expect(files[1]).not.toHaveProperty("playbackSrc");
    });

    it("does not list the files of another user's collection", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const bobs = await createCollection(bob.id, "Secrets");
        await addFile(bob.id, bobs.id, "secret.jpg", Buffer.from("s"));

        await expect(
            new CollectionService(alice.id).browseFiles(bobs.id)
        ).rejects.toThrow(NotFoundError);
    });

    it("rejects a malformed cursor, an unknown sort and another sort's cursor", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        for (const name of ["a.jpg", "b.jpg"]) {
            await addFile(user.id, trip.id, name, Buffer.from(name));
        }
        const service = new CollectionService(user.id);
        const byName = await service.browseFiles(trip.id, {
            sort: "name",
            limit: 1
        });

        await expect(
            service.browseFiles(trip.id, { cursor: "not-a-cursor" })
        ).rejects.toThrow("Malformed cursor");
        await expect(
            service.browseFiles(trip.id, { sort: "size" as FileSort })
        ).rejects.toThrow("Unknown sort");
        await expect(
            service.browseFiles(trip.id, {
                sort: "newest",
                cursor: byName.nextCursor!
            })
        ).rejects.toThrow("Malformed cursor");
    });
});

describe("Editing collections (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("changes a collection's name, description and tags", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip", {
            description: "Old",
            tags: ["travel", "summer"]
        });
        const service = new CollectionService(user.id);

        await service.updateCollection(trip.id, {
            name: "Lapland",
            description: "Northern lights",
            tags: ["winter", "travel"]
        });

        expect(await service.getCollection(trip.id)).toMatchObject({
            name: "Lapland",
            description: "Northern lights",
            tags: expect.arrayContaining(["winter", "travel"])
        });
        expect((await service.getCollection(trip.id)).tags).toHaveLength(2);
    });

    it("removes every tag when none are left", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip", {
            tags: ["travel", "summer"]
        });
        const service = new CollectionService(user.id);

        await service.updateCollection(trip.id, { name: "Trip", tags: [] });

        expect((await service.getCollection(trip.id)).tags).toEqual([]);
    });

    it("rejects a name another of the user's collections has, and keeps serving after many rejections", async () => {
        const user = await createUser("alice");
        await createCollection(user.id, "Taken");
        const trip = await createCollection(user.id, "Trip");
        const service = new CollectionService(user.id);

        for (let i = 0; i < 6; i++) {
            expect(
                await service.updateCollection(trip.id, {
                    name: "Taken",
                    tags: []
                })
            ).toEqual({ nameError: "Collection name already exists" });
        }

        expect((await service.getCollection(trip.id)).name).toBe("Trip");
    }, 15_000);

    it("does not edit or delete another user's collection", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const bobs = await createCollection(bob.id, "Secrets");
        const service = new CollectionService(alice.id);

        await expect(
            service.updateCollection(bobs.id, { name: "Mine", tags: [] })
        ).rejects.toThrow(NotFoundError);
        await expect(service.deleteCollection(bobs.id)).rejects.toThrow(
            NotFoundError
        );
        expect(
            (await new CollectionService(bob.id).getCollection(bobs.id)).name
        ).toBe("Secrets");
    });
});

describe("Creating collections and uploading files (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("creates a collection with its description and tags", async () => {
        const user = await createUser("alice");
        const service = new CollectionService(user.id);

        const { collection } = await service.createCollection(
            "Lapland",
            ["winter", "travel"],
            "Northern lights"
        );

        expect(await service.getCollection(collection!.id)).toMatchObject({
            name: "Lapland",
            description: "Northern lights",
            tags: expect.arrayContaining(["winter", "travel"]),
            imageCount: 0,
            cover: null
        });
    });

    it("rejects a name another of the user's collections has", async () => {
        const user = await createUser("alice");
        await createCollection(user.id, "Lapland");

        expect(
            await new CollectionService(user.id).createCollection("Lapland", [])
        ).toEqual({ nameError: "Collection name already exists" });
    });

    it("uploads files into a collection, skipping one with the same name and time as an existing file", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const service = new CollectionService(user.id);
        const takenAt = new Date("2024-06-01T12:00:00Z");
        const first = {
            name: "a.png",
            content: await pngImage("#ff0000"),
            mimeType: "image/png",
            lastModified: takenAt
        };
        await service.uploadFiles(trip.id, uploadRequest([first]));

        const { errors } = await service.uploadFiles(
            trip.id,
            uploadRequest([
                first,
                {
                    name: "b.png",
                    content: await pngImage("#00ff00"),
                    mimeType: "image/png",
                    lastModified: takenAt
                }
            ])
        );

        expect(errors).toEqual([
            "Skipped uploading file 'a.png' because a file with the same name and timestamp already exists in the collection"
        ]);
        expect(await browseAllFileNames(service, trip.id, { sort: "name" })).toEqual(
            ["a.png", "b.png"]
        );
        expect(await service.getCollection(trip.id)).toMatchObject({
            imageCount: 2
        });
    });
});

describe("Deleting collections (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("removes the collection from the browse and its files from the data directory", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        await createCollection(user.id, "Home");
        await addFile(user.id, trip.id, "a.jpg", Buffer.from("a"));
        const service = new CollectionService(user.id);

        await service.deleteCollection(trip.id);

        expect(await browseAllNames(service, {})).toEqual(["Home"]);
        await expect(service.getCollection(trip.id)).rejects.toThrow(
            NotFoundError
        );
        expect(existsSync(path.join(appConfig.dataDir, user.id, trip.id))).toBe(
            false
        );
    });
});

/** Postgres orders uuids by their bytes, which is the order of their lower-case text */
function compareUuids(a: string, b: string) {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()];
    return x < y ? -1 : x > y ? 1 : 0;
}

/** Every page of a collection's files, following the cursors until the last page */
async function browseAllFilePages(
    service: CollectionService,
    collectionId: string,
    query: BrowseFilesQuery
) {
    const pages: BrowseFilesPage[] = [];
    let cursor: string | undefined = query.cursor;
    do {
        const page = await service.browseFiles(collectionId, {
            ...query,
            cursor
        });
        pages.push(page);
        cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return pages;
}

/** Every file of a collection in the order a browse returns them, two to a page */
async function browseAllFiles(
    service: CollectionService,
    collectionId: string,
    query: BrowseFilesQuery
) {
    const pages = await browseAllFilePages(service, collectionId, {
        limit: 2,
        ...query
    });
    return pages.flatMap((page) => page.files);
}

async function browseAllFileNames(
    service: CollectionService,
    collectionId: string,
    query: BrowseFilesQuery
) {
    const files = await browseAllFiles(service, collectionId, query);
    return files.map((file) => file.name);
}

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

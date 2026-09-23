import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../test/database";
import {
    addFile,
    createCollection,
    createUser,
    FileMetadata
} from "../../../test/fixtures";
import { NotFoundError } from "../common/errors";
import {
    BrowseCollectionsPage,
    BrowseCollectionsQuery,
    BrowseFilesPage,
    BrowseFilesQuery,
    BrowseTimelineQuery,
    CollectionFileType,
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

describe("Filtering and searching collections (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("matches only collections that have every selected tag, ignoring case", async () => {
        const user = await createUser("alice");
        await createCollection(user.id, "Beach", { tags: ["travel", "summer"] });
        await createCollection(user.id, "Alps", { tags: ["travel", "winter"] });
        await createCollection(user.id, "Garden", { tags: ["summer"] });
        await createCollection(user.id, "Untagged");
        const service = new CollectionService(user.id);

        expect(
            (await browseAllNames(service, { tags: ["travel"] })).sort()
        ).toEqual(["Alps", "Beach"]);
        expect(
            await browseAllNames(service, { tags: ["Travel", "SUMMER"] })
        ).toEqual(["Beach"]);
        expect(
            await browseAllNames(service, { tags: ["winter", "summer"] })
        ).toEqual([]);
    });

    it("matches collections by file type: has videos, photos only or videos only", async () => {
        const user = await createUser("alice");
        await createCollectionWithFiles(user.id, "Photos", ["image/jpeg", "image/png"]);
        await createCollectionWithFiles(user.id, "Videos", ["video/mp4"]);
        await createCollectionWithFiles(user.id, "Mixed", ["image/jpeg", "video/quicktime"]);
        await createCollection(user.id, "Empty");
        const service = new CollectionService(user.id);
        const namesFor = async (fileType: CollectionFileType) =>
            (await browseAllNames(service, { fileType })).sort();

        expect(await namesFor("any")).toEqual(["Empty", "Mixed", "Photos", "Videos"]);
        expect(await namesFor("hasVideos")).toEqual(["Mixed", "Videos"]);
        expect(await namesFor("photosOnly")).toEqual(["Photos"]);
        expect(await namesFor("videosOnly")).toEqual(["Videos"]);
        await expect(
            service.browseCollections({ fileType: "gifs" as CollectionFileType })
        ).rejects.toThrow("Unknown file type");
    });

    it("searches collection names only, for a substring ignoring case", async () => {
        const user = await createUser("alice");
        await createCollection(user.id, "Summer in Lapland");
        await createCollection(user.id, "LAPLAND 2019");
        await createCollection(user.id, "Paris", {
            description: "Lapland was colder",
            tags: ["lapland"]
        });
        const weekend = await createCollection(user.id, "Weekend");
        await addFile(user.id, weekend.id, "lapland.jpg", Buffer.from("l"));
        await createCollection(user.id, "100% fun");
        const service = new CollectionService(user.id);

        expect(
            (await browseAllNames(service, { q: "lapl" })).sort()
        ).toEqual(["LAPLAND 2019", "Summer in Lapland"]);
        expect(await browseAllNames(service, { q: "  in lap " })).toEqual([
            "Summer in Lapland"
        ]);
        // Wildcards in the search are plain characters
        expect(await browseAllNames(service, { q: "0%" })).toEqual(["100% fun"]);
        expect(await browseAllNames(service, { q: "_" })).toEqual([]);
    });

    it("combines tags, file type and search with the random order and cursors, each match exactly once", async () => {
        const user = await createUser("alice");
        const matching: string[] = [];
        for (let i = 0; i < 24; i++) {
            const trip = i % 2 === 0;
            const tagged = i % 3 !== 0;
            const withVideo = i % 4 !== 1;
            const name = `${trip ? "Trip" : "Day"} ${i}`;
            await createCollectionWithFiles(
                user.id,
                name,
                withVideo ? ["image/jpeg", "video/mp4"] : ["image/jpeg"],
                { tags: tagged ? ["travel", "family"] : ["travel"] }
            );
            if (trip && tagged && withVideo) matching.push(name);
        }
        const service = new CollectionService(user.id, {
            clock: () => new Date("2026-03-01T10:05:00Z")
        });
        const query: BrowseCollectionsQuery = {
            tags: ["family", "travel"],
            fileType: "hasVideos",
            q: "trip"
        };

        const pages = await browseAllPages(service, { ...query, limit: 2 });
        const names = pages.flatMap((page) =>
            page.collections.map((c) => c.name)
        );
        const wholeRandomOrder = await browseAllNames(service, { limit: 50 });

        expect(matching.length).toBeGreaterThan(4);
        expect(pages.length).toBe(Math.ceil(matching.length / 2));
        expect([...names].sort()).toEqual([...matching].sort());
        expect(new Set(names).size).toBe(names.length);
        // The filtered collections keep their places in the random order
        expect(names).toEqual(
            wholeRandomOrder.filter((name) => matching.includes(name))
        );
    });

    it("filters and searches only the requesting user's collections", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        await createCollectionWithFiles(alice.id, "Alice trip", ["image/jpeg"], {
            tags: ["travel"]
        });
        await createCollectionWithFiles(bob.id, "Bob trip", ["image/jpeg"], {
            tags: ["travel"]
        });
        await createCollectionWithFiles(bob.id, "Bob videos", ["video/mp4"]);
        const service = new CollectionService(alice.id);

        expect(await browseAllNames(service, { tags: ["travel"] })).toEqual([
            "Alice trip"
        ]);
        expect(await browseAllNames(service, { q: "trip" })).toEqual([
            "Alice trip"
        ]);
        expect(
            await browseAllNames(service, { fileType: "photosOnly" })
        ).toEqual(["Alice trip"]);
        expect(
            await browseAllNames(service, { fileType: "videosOnly" })
        ).toEqual([]);
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

    it("filters files by file tag, matching only files that have every tag, with any sort and cursors", async () => {
        const user = await createUser("alice");
        // A collection tag does not tag its files
        const trip = await createCollection(user.id, "Trip", {
            tags: ["sunset"]
        });
        const files: [string, string[]][] = [
            ["a.jpg", ["sunset", "beach"]],
            ["b.jpg", ["Sunset"]],
            ["c.jpg", ["beach"]],
            ["d.jpg", ["sunset", "beach", "family"]],
            ["e.jpg", []],
            ["f.jpg", ["SUNSET", "Beach"]]
        ];
        for (const [name, tags] of files) {
            await addFile(user.id, trip.id, name, Buffer.from(name), { tags });
        }
        const service = new CollectionService(user.id);

        for (const sort of ["newest", "oldest", "name"] as const) {
            const names = await browseAllFileNames(service, trip.id, {
                sort,
                tags: ["beach", "sunset"]
            });
            expect(names.sort()).toEqual(["a.jpg", "d.jpg", "f.jpg"]);
        }
        expect(
            await browseAllFileNames(service, trip.id, {
                sort: "name",
                tags: ["sunset"]
            })
        ).toEqual(["a.jpg", "b.jpg", "d.jpg", "f.jpg"]);
        expect(
            await browseAllFileNames(service, trip.id, {
                tags: ["family", "missing"]
            })
        ).toEqual([]);
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

describe("Browsing the Timeline (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    const day = (d: number, hour = 0) => new Date(Date.UTC(2022, 0, d, hour));

    it("lists files from every collection newest first, dated by taken-at time or else creation time, then by id", async () => {
        const user = await createUser("alice");
        const trip = await createCollection(user.id, "Trip");
        const home = await createCollection(user.id, "Home");
        const ids: Record<string, string> = {};
        const files: [string, string, FileMetadata][] = [
            // Dated by taken-at time, although created last
            [trip.id, "beach.jpg", { createdAt: day(20), takenAt: day(1) }],
            // No taken-at time: dated by creation time
            [home.id, "scan.jpg", { createdAt: day(5) }],
            // Three files on the same date in two collections: only the id orders them
            [trip.id, "tie-1.jpg", { createdAt: day(10) }],
            [home.id, "tie-2.jpg", { createdAt: day(12), takenAt: day(10) }],
            [home.id, "tie-3.jpg", { createdAt: day(10) }],
            [trip.id, "clip.mp4", { createdAt: day(15), mimeType: "video/mp4" }]
        ];
        for (const [collectionId, name, metadata] of files) {
            const file = await addFile(
                user.id,
                collectionId,
                name,
                Buffer.from(name),
                metadata
            );
            ids[name] = file.id;
        }
        const tiedByIdDescending = ["tie-1.jpg", "tie-2.jpg", "tie-3.jpg"].sort(
            (a, b) => compareUuids(ids[b], ids[a])
        );

        const timeline = await browseWholeTimeline(
            new CollectionService(user.id),
            { limit: 2 }
        );

        expect(timeline.map((file) => file.name)).toEqual([
            "clip.mp4",
            ...tiedByIdDescending,
            "scan.jpg",
            "beach.jpg"
        ]);
        expect(timeline.find((file) => file.name === "scan.jpg")).toMatchObject(
            {
                collectionId: home.id,
                timestamp: day(5).getTime(),
                thumbnailSrc: `/api/collections/${home.id}/files?thumbnail=${ids["scan.jpg"]}`
            }
        );
    });

    it("pages concatenated through cursors contain every file exactly once", async () => {
        const user = await createUser("alice");
        const collections = [
            await createCollection(user.id, "Trip"),
            await createCollection(user.id, "Home"),
            await createCollection(user.id, "Empty")
        ];
        const names: string[] = [];
        for (let i = 0; i < 13; i++) {
            const name = `photo-${i}.jpg`;
            names.push(name);
            // Pairs of files share a date across collections, so pages end inside ties
            await addFile(
                user.id,
                collections[i % 2].id,
                name,
                Buffer.from(name),
                {
                    createdAt: day(1 + Math.floor(i / 2))
                }
            );
        }
        const service = new CollectionService(user.id);

        const pages = await browseTimelinePages(service, { limit: 3 });
        const whole = await service.browseTimeline({ limit: 100 });

        expect(pages.map((page) => page.files.length)).toEqual([3, 3, 3, 3, 1]);
        expect(pages.at(-1)!.nextCursor).toBeNull();
        expect(
            pages.flatMap((page) => page.files.map((file) => file.name))
        ).toEqual(whole.files.map((file) => file.name));
        expect(whole.files.map((file) => file.name).sort()).toEqual(
            [...names].sort()
        );
    });

    it("lists only the requesting user's files", async () => {
        const alice = await createUser("alice");
        const bob = await createUser("bob");
        const alices = await createCollection(alice.id, "Mine");
        const bobs = await createCollection(bob.id, "Secrets");
        await addFile(alice.id, alices.id, "mine.jpg", Buffer.from("m"), {
            createdAt: day(1)
        });
        // Newer than alice's file, so it would come first if it leaked
        await addFile(bob.id, bobs.id, "secret.jpg", Buffer.from("s"), {
            createdAt: day(2)
        });

        const timeline = await browseWholeTimeline(
            new CollectionService(alice.id),
            {}
        );

        expect(timeline.map((file) => file.name)).toEqual(["mine.jpg"]);
    });

    it("rejects a malformed cursor and a cursor of another order", async () => {
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
            service.browseTimeline({ cursor: "not-a-cursor" })
        ).rejects.toThrow("Malformed cursor");
        await expect(
            service.browseTimeline({ cursor: byName.nextCursor! })
        ).rejects.toThrow("Malformed cursor");
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

/** A collection with one file of each of the given types */
async function createCollectionWithFiles(
    userId: string,
    name: string,
    mimeTypes: string[],
    options: { tags?: string[] } = {}
) {
    const collection = await createCollection(userId, name, options);
    for (let i = 0; i < mimeTypes.length; i++) {
        await addFile(userId, collection.id, `file-${i}`, Buffer.from(name), {
            mimeType: mimeTypes[i]
        });
    }
    return collection;
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

/** Every page of the Timeline, following the cursors until the last page */
async function browseTimelinePages(
    service: CollectionService,
    query: BrowseTimelineQuery
) {
    const pages: BrowseFilesPage[] = [];
    let cursor: string | undefined = query.cursor;
    do {
        const page = await service.browseTimeline({ ...query, cursor });
        pages.push(page);
        cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return pages;
}

/** Every file on the Timeline in the order it lists them, across all pages */
async function browseWholeTimeline(
    service: CollectionService,
    query: BrowseTimelineQuery
) {
    const pages = await browseTimelinePages(service, query);
    return pages.flatMap((page) => page.files);
}

// The seed's verification: scenarios stated the way a User sees them, each
// checked through the public HTTP API while signed in as that User. A check
// throws a CheckFailure, or any other error, when its scenario is not there.

import { COLLECTIONS, SEEDED_AT, USERS, fileName } from "./plan.mjs";
import { BROKEN_VIDEO } from "./samples.mjs";

export class CheckFailure extends Error {}

/** Fails the check with the detail unless the condition holds */
function expect(condition, detail) {
    if (!condition) {
        throw new CheckFailure(detail);
    }
}

function names(collectionsOrFiles) {
    return collectionsOrFiles.map(({ name }) => name);
}

/** Fails unless the names seen are the names planned, in any order */
function expectSameNames(seen, planned, whatWasSeen) {
    const [seenSorted, plannedSorted] = [seen, planned].map((list) =>
        [...list].sort()
    );
    expect(
        JSON.stringify(seenSorted) === JSON.stringify(plannedSorted),
        `${whatWasSeen} [${seenSorted.join(", ")}], planned [${plannedSorted.join(", ")}]`
    );
}

function plannedCollectionsOf(user) {
    return COLLECTIONS.filter((collection) => collection.owner === user);
}

/** The User's planned collection of that name; fails if there is none */
function plannedCollection(user, name) {
    const planned = plannedCollectionsOf(user).find((c) => c.name === name);
    expect(planned, `${user} has an unplanned collection '${name}'`);
    return planned;
}

/** A planned collection's Last opened, or undefined if it is never opened */
function lastOpened(planned) {
    return planned.opens?.at(-1);
}

function allCollections(api) {
    return api.all("/api/collections", "collections", { sort: "name" });
}

function collectionFiles(api, collectionId) {
    return api.all(`/api/collections/${collectionId}/files`, "files", {
        sort: "name"
    });
}

function timeline(api) {
    return api.all("/api/files", "files");
}

/**
 * @typedef {Record<keyof typeof USERS, import("./api.mjs").Api>} SignedIn
 *   a fresh session for every User
 * @typedef {{ scenario: string, run: (users: SignedIn) => Promise<void> }} Check
 */

/** The User sees their planned collections, and no others @returns {Check} */
function collectionsCheck(user) {
    return {
        scenario: `${user} sees exactly their ${plannedCollectionsOf(user).length} planned collection(s)`,
        run: async (users) => {
            const seen = names(await allCollections(users[user]));
            const planned = plannedCollectionsOf(user).map((c) => c.name);
            expectSameNames(seen, planned, "saw");
        }
    };
}

/** Each of the User's collections holds its planned files @returns {Check} */
function filesCheck(user) {
    return {
        scenario: `${user} sees the planned files in each of their collections, with thumbnails`,
        run: async (users) => {
            const api = users[user];
            const collections = await allCollections(api);
            for (const planned of plannedCollectionsOf(user)) {
                const collection = collections.find(
                    (c) => c.name === planned.name
                );
                expect(collection, `'${planned.name}' is missing`);
                const files = await collectionFiles(api, collection.id);
                const seen = names(files);
                const expected = planned.files.map(fileName);
                expectSameNames(seen, expected, `'${planned.name}' holds`);
                const counted =
                    collection.imageCount + collection.videoCount;
                expect(
                    counted === expected.length,
                    `the card of '${planned.name}' counts ${counted} file(s), planned ${expected.length}`
                );
                if (files.length > 0) {
                    const res = await api.request("GET", files[0].thumbnailSrc);
                    expect(
                        res.ok &&
                            res.headers.get("content-type")?.startsWith("image/"),
                        `the thumbnail of '${files[0].name}' in '${planned.name}' answered ${res.status}`
                    );
                }
            }
        }
    };
}

/** Every User's planned collections and files are there for them @type {Check[]} */
const planChecks = Object.keys(USERS).flatMap((user) =>
    plannedCollectionsOf(user).length > 0
        ? [collectionsCheck(user), filesCheck(user)]
        : [collectionsCheck(user)]
);

/** Checks no User can reach another User's collections or files @type {Check[]} */
const isolationChecks = Object.keys(USERS).flatMap((user) =>
    Object.keys(USERS)
        .filter((owner) => owner !== user)
        .map((owner) => ({
            scenario: `${user} sees none of ${owner}'s collections or files`,
            run: async (users) => {
                const api = users[user];
                const theirs = await allCollections(users[owner]);
                const theirFiles = await timeline(users[owner]);
                const theirIds = new Set([
                    ...theirs.map((c) => c.id),
                    ...theirFiles.map((f) => f.id)
                ]);

                const mine = await allCollections(api);
                const myFiles = await timeline(api);
                const leaked = [...mine, ...myFiles].filter((item) =>
                    theirIds.has(item.id)
                );
                expect(
                    leaked.length === 0,
                    `saw ${owner}'s ${names(leaked).join(", ")}`
                );

                for (const collection of theirs) {
                    const res = await api.request(
                        "GET",
                        `/api/collections/${collection.id}`
                    );
                    expect(
                        !res.ok,
                        `opening ${owner}'s '${collection.name}' answered ${res.status}`
                    );
                }
                const file = theirFiles[0];
                if (file) {
                    const res = await api.request("GET", file.thumbnailSrc);
                    expect(
                        !res.ok,
                        `the thumbnail of ${owner}'s '${file.name}' answered ${res.status}`
                    );
                }
            }
        }))
);

/** The page size the Collections tab and collection pages load, the API's default */
const PAGE_SIZE = 48;

/**
 * Pages through a paged list at the default page size, following each page's
 * cursor. Fails unless there are at least two full pages' worth to reach.
 */
async function pageThrough(api, path, key, query = {}) {
    const first = await api.get(path, query);
    expect(
        first[key].length === PAGE_SIZE && first.nextCursor,
        `the first page holds ${first[key].length} and ${first.nextCursor ? "has" : "has no"} cursor to a next page`
    );
    const pages = [first[key]];
    let cursor = first.nextCursor;
    while (cursor) {
        const page = await api.get(path, { ...query, cursor });
        pages.push(page[key]);
        cursor = page.nextCursor;
    }
    const ids = pages.flat().map(({ id }) => id);
    expect(
        new Set(ids).size === ids.length,
        "following the cursor showed some of them again"
    );
    return pages;
}

/**
 * Runs before every other check: video processing gets through the sample
 * videos in seconds, so it is over soon after the seed uploads the last ones
 * @type {Check}
 */
const activityCheck = {
    scenario: "demo's Activity shows videos in video processing, among them an H.264 MP4, an HEVC MOV and the broken video",
    run: async ({ demo }) => {
        const { activity } = await demo.get("/api/activity");
        const { pending, processing } = activity.videoProcessing;
        expect(
            activity.active && pending + processing > 0,
            `Activity shows ${pending} pending and ${processing} processing`
        );

        // Until video processing is done with a video, it has no Scrub preview
        const { videos: failed } = await demo.get("/api/video-processing/failed");
        const failedIds = new Set(failed.map(({ id }) => id));
        const waiting = (await timeline(demo)).filter(
            (file) =>
                file.mimeType.startsWith("video/") &&
                !file.scrubPreview &&
                !failedIds.has(file.id)
        );
        const kinds = {
            "an H.264 MP4": (file) =>
                file.mimeType === "video/mp4" && !isBrokenVideo(file),
            "an HEVC MOV": (file) => file.mimeType === "video/quicktime",
            "the broken video": isBrokenVideo
        };
        const missing = Object.entries(kinds)
            .filter(([, isKind]) => !waiting.some(isKind))
            .map(([kind]) => kind);
        expect(
            missing.length === 0,
            `video processing is already done with ${missing.join(" and ")}`
        );
    }
};

/** Whether the file is the broken sample video, under whatever name the plan gave it */
function isBrokenVideo(file) {
    return COLLECTIONS.some((planned) =>
        planned.files.some(
            (f) => f.sample === BROKEN_VIDEO && fileName(f) === file.name
        )
    );
}

/** The scenarios the demo exists for, as demo and other see them @type {Check[]} */
const scenarioChecks = [
    {
        scenario: `demo has more than ${PAGE_SIZE} collections, and the cursor leads to the next page`,
        run: async ({ demo }) => {
            await pageThrough(demo, "/api/collections", "collections");
        }
    },
    {
        scenario: `demo has a collection of more than ${PAGE_SIZE} files, and the cursor leads to its next page`,
        run: async ({ demo }) => {
            const big = (await allCollections(demo)).find(
                (c) => c.imageCount + c.videoCount > PAGE_SIZE
            );
            expect(big, `no collection has more than ${PAGE_SIZE} files`);
            const pages = await pageThrough(
                demo,
                `/api/collections/${big.id}/files`,
                "files"
            );
            const seen = pages.flat().length;
            expect(
                seen === big.imageCount + big.videoCount,
                `paging through '${big.name}' showed ${seen} of its ${big.imageCount + big.videoCount} files`
            );
        }
    },
    {
        scenario: "demo has an empty collection, without a Cover",
        run: async ({ demo }) => {
            const empty = (await allCollections(demo)).find(
                (c) => c.imageCount + c.videoCount === 0
            );
            expect(empty, "every collection has files");
            expect(!empty.cover, `the empty '${empty.name}' has a Cover`);
            const files = await collectionFiles(demo, empty.id);
            expect(
                files.length === 0,
                `the empty '${empty.name}' shows ${files.length} file(s)`
            );
        }
    },
    {
        scenario: "demo has Chosen covers, one of them a video, and collections without one still show a Cover",
        run: async ({ demo }) => {
            const collections = await allCollections(demo);
            const chosen = collections.filter((c) => c.cover?.chosen);
            expect(chosen.length >= 2, `${chosen.length} collection(s) have a Chosen cover`);
            const coverTypes = await Promise.all(
                chosen.map(async (c) => {
                    const coverId = new URL(c.cover.thumbnailSrc, "http://demo")
                        .searchParams.get("thumbnail");
                    const files = await collectionFiles(demo, c.id);
                    return files.find((file) => file.id === coverId)?.mimeType;
                })
            );
            expect(
                coverTypes.some((type) => type?.startsWith("video/")),
                `the Chosen covers are ${coverTypes.join(", ")}, none a video`
            );
            expect(
                collections.some((c) => c.cover && !c.cover.chosen),
                "no collection without a Chosen cover shows a Cover"
            );
        }
    },
    {
        scenario: "demo's Forgotten collections are the ones planned, one never opened and one last opened more than a year ago",
        run: async ({ demo }) => {
            const yearAgo = new Date(SEEDED_AT);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            const planned = plannedCollectionsOf("demo").filter(
                (c) => (lastOpened(c) ?? c.created) < yearAgo
            );
            expect(
                planned.some((c) => !lastOpened(c)) &&
                    planned.some((c) => lastOpened(c)),
                `the plan's Forgotten collections [${names(planned).join(", ")}] are not of both kinds`
            );
            const forgotten = await demo.all("/api/collections", "collections", {
                forgotten: true
            });
            expectSameNames(names(forgotten), names(planned), "Forgotten are");
        }
    },
    {
        scenario: "demo's collections have differing Open counts and Last opened times, and sort by them",
        run: async ({ demo }) => {
            const openCount = (c) => c.opens?.length ?? 0;
            const lastOpenedTime = (c) => lastOpened(c)?.getTime() ?? -Infinity;
            for (const { sort, key, what } of [
                { sort: "mostOpened", key: openCount, what: "Open counts" },
                { sort: "recentlyOpened", key: lastOpenedTime, what: "Last opened times" }
            ]) {
                const sorted = (
                    await demo.all("/api/collections", "collections", { sort })
                ).map((c) => plannedCollection("demo", c.name));
                const keys = sorted.map(key);
                expect(
                    new Set(keys).size >= 3,
                    `demo's collections have only ${new Set(keys).size} different ${what}`
                );
                const outOfOrder = sorted.findIndex(
                    (c, i) => i > 0 && key(c) > key(sorted[i - 1])
                );
                expect(
                    outOfOrder === -1,
                    `sorted by ${what}, '${sorted[outOfOrder]?.name}' comes after '${sorted[outOfOrder - 1]?.name}'`
                );
            }
        }
    },
    {
        scenario: "demo's collections were last added to at staggered times, in another order than they were created",
        run: async ({ demo }) => {
            const byLastAddedTo = await demo.all("/api/collections", "collections", {
                sort: "lastAddedTo"
            });
            for (const collection of byLastAddedTo) {
                const planned = plannedCollection("demo", collection.name);
                const expected = planned.added ?? planned.created;
                expect(
                    Math.abs(collection.lastAddedTo - expected.getTime()) < 1000,
                    `'${collection.name}' was last added to ${new Date(collection.lastAddedTo).toISOString()}, planned ${expected.toISOString()}`
                );
            }
            expect(
                new Set(byLastAddedTo.map((c) => c.lastAddedTo)).size >= 10,
                "fewer than 10 different Last added to times"
            );
            const byCreation = plannedCollectionsOf("demo")
                .toSorted((a, b) => b.created.getTime() - a.created.getTime())
                .map((c) => c.name);
            expect(
                names(byLastAddedTo).join("|") !== byCreation.join("|"),
                "sorted by Last added to, the collections are in the order they were created"
            );
        }
    },
    {
        scenario: "demo has tags on collections and on files, one written in two cases, and filtering by either finds both",
        run: async ({ demo }) => {
            const collections = await allCollections(demo);
            const byLowerCase = Map.groupBy(
                [...new Set(collections.flatMap((c) => c.tags))],
                (tag) => tag.toLowerCase()
            );
            const cases = [...byLowerCase.values()].find((tags) => tags.length > 1);
            expect(cases, "no collection tag is written in two cases");
            const tagged = collections.filter((c) =>
                c.tags.some((tag) => cases.includes(tag))
            );
            for (const tag of cases) {
                const found = await demo.all("/api/collections", "collections", {
                    tags: tag
                });
                expectSameNames(names(found), names(tagged), `filtering by '${tag}' found`);
            }

            const fileTags = await demo.get("/api/tags", { scope: "files" });
            expect(fileTags.tags.length > 0, "no file has a tag");
            const taggedFiles = (await timeline(demo)).filter((f) => f.tags.length > 0);
            expect(taggedFiles.length > 0, "no file on the Timeline shows a tag");
        }
    },
    {
        scenario: "demo's Timeline has files taken over several years, some with GPS and some without",
        run: async ({ demo }) => {
            const files = await timeline(demo);
            const years = new Set(
                files.map((f) => new Date(f.timestamp).getUTCFullYear())
            );
            expect(years.size >= 5, `the Timeline spans only ${[...years].join(", ")}`);
            const withGps = files.filter((f) => f.gps);
            expect(
                withGps.length > 0 && withGps.length < files.length,
                `${withGps.length} of the Timeline's ${files.length} files have GPS`
            );
        }
    },
    {
        scenario: "demo has no Backup yet",
        run: async ({ demo }) => {
            const { jobs } = await demo.get("/api/backups");
            expect(jobs.length === 0, `demo has ${jobs.length} Backup job(s)`);
        }
    },
    {
        scenario: "other has a few collections of their own, and sees none of demo's tags or Activity",
        run: async ({ demo, other }) => {
            const theirs = await allCollections(other);
            expect(theirs.length >= 3, `other has ${theirs.length} collection(s)`);

            const tagsOf = async (api) =>
                (
                    await Promise.all(
                        ["collections", "files"].map(
                            async (scope) => (await api.get("/api/tags", { scope })).tags
                        )
                    )
                )
                    .flat()
                    .map(({ name }) => name.toLowerCase());
            const othersTags = new Set(await tagsOf(other));
            const plannedTags = new Set(
                plannedCollectionsOf("other")
                    .flatMap((c) => [...(c.tags ?? []), ...c.files.flatMap((f) => f.tags ?? [])])
                    .map((tag) => tag.toLowerCase())
            );
            const demosOnly = (await tagsOf(demo)).filter((tag) => !plannedTags.has(tag));
            expect(demosOnly.length > 0, "demo has no tags of their own");
            for (const tag of demosOnly) {
                expect(!othersTags.has(tag), `other sees demo's tag '${tag}'`);
                const { tags: suggested } = await other.get("/api/tags/suggestions", {
                    query: tag
                });
                expect(
                    !suggested.some((s) => s.toLowerCase() === tag),
                    `other is suggested demo's tag '${tag}'`
                );
            }

            const { activity } = await other.get("/api/activity");
            const { pending, processing, done, failed, currentFile } =
                activity.videoProcessing;
            expect(
                !activity.active &&
                    pending + processing + done + failed === 0 &&
                    !currentFile &&
                    !activity.backupJob,
                `other's Activity shows ${pending} pending, ${processing} processing, ${done} done and ${failed} failed videos${currentFile ? `, '${currentFile.name}' now` : ""}`
            );
        }
    }
];

/** Every check, in the order they run @type {Check[]} */
export const CHECKS = [
    activityCheck,
    ...planChecks,
    ...scenarioChecks,
    ...isolationChecks
];

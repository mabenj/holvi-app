// The seed's verification: scenarios stated the way a User sees them, each
// checked through the public HTTP API while signed in as that User. A check
// throws a CheckFailure, or any other error, when its scenario is not there.

import { COLLECTIONS, USERS, fileName } from "./plan.mjs";

export class CheckFailure extends Error {}

/** Fails the check with the detail unless the condition holds */
function expect(condition, detail) {
    if (!condition) {
        throw new CheckFailure(detail);
    }
}

/** A multiset of names, sorted, for comparing what is seen with what was planned */
function names(items) {
    return items.map((item) => item.name).sort();
}

function sameNames(seen, planned) {
    return JSON.stringify(seen) === JSON.stringify([...planned].sort());
}

function plannedCollectionsOf(user) {
    return COLLECTIONS.filter((collection) => collection.owner === user);
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
            expect(
                sameNames(seen, planned),
                `saw [${seen.join(", ")}], planned [${[...planned].sort().join(", ")}]`
            );
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
                expect(
                    sameNames(seen, expected),
                    `'${planned.name}' holds [${seen.join(", ")}], planned [${[...expected].sort().join(", ")}]`
                );
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

/** Every check, in the order they run @type {Check[]} */
export const CHECKS = [...planChecks, ...isolationChecks];

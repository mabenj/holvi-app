// Seeds an empty demo with the scenario plan, then checks every scenario is
// there. Seeding goes through the app's public HTTP API, except for the times
// the API cannot set, which it backdates straight in the database: when
// collections and files were created, and when Opens were. Does nothing when
// the demo is already seeded, so data made while testing survives, and fails
// when an earlier seed stopped partway. Runs in the demo's seed service once
// the app is healthy:
//
//   HOLVI_DEMO_URL=http://app:3000 \
//   HOLVI_DEMO_DB_CONNECTION_STRING=postgres://... node demo/seed/seed.mjs
//
// Exits non-zero, naming what failed, when seeding or any check fails.

import pg from "pg";
import { Api } from "./api.mjs";
import { CHECKS } from "./checks.mjs";
import { SAMPLES } from "./samples.mjs";
import { COLLECTIONS, SEEDED_AT, USERS, fileName } from "./plan.mjs";

const baseUrl = requireEnv("HOLVI_DEMO_URL");
const connectionString = requireEnv("HOLVI_DEMO_DB_CONNECTION_STRING");

/**
 * The seed's own table in the demo database, which the app's models never
 * touch: it holds a row once a seed has passed every check
 */
const MARKER_TABLE = "demo_seed";

/** A visit less than this after the previous one extends that Open */
const OPEN_WINDOW_MS = 30 * 60_000;

const db = new pg.Client({ connectionString });
try {
    await db.connect();
} catch (error) {
    fail("Could not connect to the demo database", error);
}

let state;
try {
    state = await seedState();
} catch (error) {
    fail("Could not tell whether the demo is seeded", error);
}
if (state === "seeded") {
    console.log("The demo is already seeded");
    process.exit(0);
}
if (state === "partial") {
    fail(
        `User '${USERS.demo.username}' exists, but no seed of this demo ever passed its checks: ` +
            "an earlier seed failed partway. " +
            "Run ./demo.sh reset to seed the demo again from scratch."
    );
}

try {
    const created = await seedThroughApi();
    await backdate(created);
} catch (error) {
    fail("Seeding failed", error);
}

const failures = await verify();
if (failures.length > 0) {
    console.error(`\n${failures.length} seed check(s) failed:`);
    failures.forEach((scenario) => console.error(`  - ${scenario}`));
    process.exit(1);
}

try {
    await markSeeded();
} catch (error) {
    fail("Could not record that the demo is seeded", error);
}
await db.end();
console.log("\nThe demo is seeded and every check passed");

/**
 * Read straight from the database: "empty" without User demo, "seeded" once
 * a seed has passed its checks, "partial" otherwise. The one place that
 * decides whether to seed.
 */
async function seedState() {
    const { rows } = await db.query(
        `SELECT to_regclass('"Users"') IS NOT NULL AS "hasUsers",
                to_regclass($1) IS NOT NULL AS "hasMarker"`,
        [MARKER_TABLE]
    );
    if (!rows[0].hasUsers) {
        return "empty";
    }
    const users = await db.query(`SELECT 1 FROM "Users" WHERE username = $1`, [
        USERS.demo.username
    ]);
    if (users.rowCount === 0) {
        return "empty";
    }
    if (rows[0].hasMarker) {
        const marker = await db.query(`SELECT 1 FROM ${MARKER_TABLE}`);
        if (marker.rowCount > 0) {
            return "seeded";
        }
    }
    return "partial";
}

/** Records that this seed passed every check, so no later up seeds again */
async function markSeeded() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (
            seeded_at timestamptz NOT NULL DEFAULT now()
        )`
    );
    await db.query(`INSERT INTO ${MARKER_TABLE} DEFAULT VALUES`);
}

/**
 * Seeding: the plan, through the same public API routes the UI uses. Returns
 * the collections as created.
 */
async function seedThroughApi() {
    const sessions = {};
    for (const [user, { username, password }] of Object.entries(USERS)) {
        console.log(`Signing up ${username}`);
        sessions[user] = await Api.signUp(baseUrl, username, password);
    }

    /** @type {CreatedCollection[]} */
    const created = [];
    for (const planned of COLLECTIONS) {
        const api = sessions[planned.owner];
        console.log(`Creating ${planned.owner}'s collection '${planned.name}'`);
        const id = await api.createCollection(planned);
        const collection = { planned, api, id, fileIds: new Map() };
        created.push(collection);
        await uploadFiles(collection, "image/");
    }

    for (const collection of created) {
        await recordOpens(collection);
    }

    // Videos last: video processing starts on each upload and gets through
    // the sample videos in seconds, so only the last ones uploaded are still
    // in Activity when the checks start
    console.log("Uploading the videos");
    for (const collection of created) {
        await uploadFiles(collection, "video/");
    }

    for (const collection of created) {
        await tagFiles(collection);
        await chooseCover(collection);
    }
    return created;
}

/**
 * @typedef {{
 *   planned: import("./plan.mjs").PlannedCollection,
 *   api: Api,
 *   id: string,
 *   fileIds: Map<string, string>
 * }} CreatedCollection a planned collection as created: its owner's
 *   session, its id and its uploaded files' ids by name
 */

/**
 * Puts the planned file tags on the collection's files, each tag on all its
 * files at once, as the UI tags a selection
 * @param {CreatedCollection} collection
 */
async function tagFiles(collection) {
    const { planned, api } = collection;
    const filesByTag = Map.groupBy(
        planned.files.flatMap((file) => (file.tags ?? []).map((tag) => ({ tag, file }))),
        ({ tag }) => tag
    );
    for (const [tag, tagged] of filesByTag) {
        console.log(`Tagging ${tagged.length} file(s) in '${planned.name}' with '${tag}'`);
        await api.send("POST", "/api/tags/bulk", {
            target: "files",
            ids: tagged.map(({ file }) => fileIdOf(collection, fileName(file))),
            add: [tag],
            remove: []
        });
    }
}

/**
 * Makes the planned file the collection's Chosen cover, if it has one
 * @param {CreatedCollection} collection
 */
async function chooseCover(collection) {
    const { planned, api, id } = collection;
    if (!planned.cover) {
        return;
    }
    console.log(`Choosing '${planned.cover}' as the Chosen cover of '${planned.name}'`);
    await api.send("PUT", `/api/collections/${id}/cover`, {
        fileId: fileIdOf(collection, planned.cover)
    });
}

/**
 * Records the collection's planned Opens through the API, moving each one
 * back to its planned time before the next. The app keeps only an Open count
 * and Last opened, and counts a visit as another Open only when Last opened
 * is 30 minutes old, so each Open's time is written as soon as it is made.
 * @param {CreatedCollection} collection
 */
async function recordOpens({ planned, api, id }) {
    for (const [i, openedAt] of (planned.opens ?? []).entries()) {
        const earliestNext = planned.opens[i + 1] ?? SEEDED_AT;
        if (earliestNext.getTime() - openedAt.getTime() < OPEN_WINDOW_MS) {
            throw new Error(
                `'${planned.name}' has an Open less than 30 minutes before its next one or the seed`
            );
        }
        await api.send("POST", `/api/collections/${id}/opens`);
        await db.query(`UPDATE "Collections" SET "lastOpened" = $2 WHERE id = $1`, [
            id,
            openedAt
        ]);
    }
    if (planned.opens?.length) {
        console.log(`Opened '${planned.name}' ${planned.opens.length} time(s)`);
    }
}

/**
 * Backdating, straight in the database, of the times the API cannot set:
 * when each collection was created, and when its files were (its Last added
 * to). The times of Opens are backdated as they are recorded.
 * @param {CreatedCollection[]} created
 */
async function backdate(created) {
    console.log("\nBackdating creation times");
    await db.query("BEGIN");
    try {
        for (const { planned, id } of created) {
            await db.query(`UPDATE "Collections" SET "createdAt" = $2 WHERE id = $1`, [
                id,
                planned.created
            ]);
            if (planned.files.length > 0) {
                await db.query(
                    `UPDATE "CollectionFiles" SET "createdAt" = $2 WHERE "CollectionId" = $1`,
                    [id, planned.added]
                );
            }
        }
        await db.query("COMMIT");
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
}

/** The id of the collection's uploaded file of that name @param {CreatedCollection} collection */
function fileIdOf(collection, name) {
    const id = collection.fileIds.get(name);
    if (!id) {
        throw new Error(`'${collection.planned.name}' has no planned file '${name}'`);
    }
    return id;
}

/**
 * Uploads the planned files of one type, e.g. "video/", as the client does,
 * and notes their ids
 * @param {CreatedCollection} collection
 * @param {"image/" | "video/"} mimeTypePrefix
 */
async function uploadFiles(collection, mimeTypePrefix) {
    const { planned, api } = collection;
    const files = await Promise.all(
        planned.files
            .filter((file) => sampleOf(file).mimeType.startsWith(mimeTypePrefix))
            .map(async (file) => {
                const sample = sampleOf(file);
                return {
                    name: fileName(file),
                    mimeType: sample.mimeType,
                    content: await sample.content(),
                    lastModified: planned.added
                };
            })
    );
    if (files.length > 0) {
        console.log(`  uploading ${files.length} file(s) into '${planned.name}'`);
        const uploaded = await api.upload(collection.id, files);
        uploaded.forEach(({ id, name }) => collection.fileIds.set(name, id));
    }
}

function sampleOf(file) {
    const sample = SAMPLES[file.sample];
    if (!sample) {
        throw new Error(`demo/media has no sample file '${file.sample}'`);
    }
    return sample;
}

/**
 * Verification: every check, each User signed in afresh. Returns the
 * scenarios that are missing, each with why.
 */
async function verify() {
    console.log("\nChecking the seed");
    const users = {};
    for (const [user, { username, password }] of Object.entries(USERS)) {
        try {
            users[user] = await Api.logIn(baseUrl, username, password);
        } catch (error) {
            return [`${username} signs in: ${describe(error)}`];
        }
    }

    const failures = [];
    for (const check of CHECKS) {
        try {
            await check.run(users);
            console.log(`  ok   ${check.scenario}`);
        } catch (error) {
            console.log(`  FAIL ${check.scenario}`);
            failures.push(`${check.scenario}: ${describe(error)}`);
        }
    }
    return failures;
}

function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        fail(`Environment variable ${key} is not set`);
    }
    return value;
}

function describe(error) {
    return error instanceof Error ? error.message : String(error);
}

function fail(message, error) {
    console.error(error === undefined ? message : `${message}: ${describe(error)}`);
    process.exit(1);
}

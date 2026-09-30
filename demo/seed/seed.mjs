// Seeds an empty demo with the scenario plan, then checks every scenario is
// there. Does nothing when the demo is already seeded, so data made while
// testing survives, and fails when an earlier seed stopped partway. Runs in
// the demo's seed service once the app is healthy:
//
//   HOLVI_DEMO_URL=http://app:3000 \
//   HOLVI_DEMO_DB_CONNECTION_STRING=postgres://... node demo/seed/seed.mjs
//
// Exits non-zero, naming what failed, when seeding or any check fails.

import pg from "pg";
import { Api } from "./api.mjs";
import { CHECKS } from "./checks.mjs";
import { SAMPLES } from "./samples.mjs";
import { COLLECTIONS, USERS, fileName } from "./plan.mjs";

const baseUrl = requireEnv("HOLVI_DEMO_URL");
const connectionString = requireEnv("HOLVI_DEMO_DB_CONNECTION_STRING");

// The plan's last collection of User demo: seeding creates it after every
// User and every other collection of theirs, so without it the seed failed
const marker = COLLECTIONS.findLast((collection) => collection.owner === "demo");

let state;
try {
    state = await seedState();
} catch (error) {
    fail("Could not tell whether the demo is seeded", error);
}
if (state === "seeded") {
    console.log(
        `User '${USERS.demo.username}' and their collection '${marker.name}' exist: the demo is already seeded`
    );
    process.exit(0);
}
if (state === "partial") {
    fail(
        `User '${USERS.demo.username}' exists without their collection '${marker.name}', ` +
            "the last one the seed creates: an earlier seed failed partway, " +
            "or the collection was renamed or deleted. " +
            "Run ./demo.sh reset to seed the demo again from scratch."
    );
}

try {
    await seedThroughApi();
} catch (error) {
    fail("Seeding failed", error);
}

const failures = await verify();
if (failures.length > 0) {
    console.error(`\n${failures.length} seed check(s) failed:`);
    failures.forEach((scenario) => console.error(`  - ${scenario}`));
    process.exit(1);
}
console.log("\nThe demo is seeded and every check passed");

/**
 * Read straight from the database: "empty" without User demo, "seeded" with
 * User demo and their last planned collection, "partial" with only the User.
 * The one place that decides whether to seed.
 */
async function seedState() {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
        const { rows } = await client.query(
            `SELECT to_regclass('"Users"') IS NOT NULL AS "hasUsers"`
        );
        if (!rows[0].hasUsers) {
            return "empty";
        }
        const users = await client.query(
            `SELECT id FROM "Users" WHERE username = $1`,
            [USERS.demo.username]
        );
        if (users.rowCount === 0) {
            return "empty";
        }
        const collections = await client.query(
            `SELECT 1 FROM "Collections" WHERE "UserId" = $1 AND name = $2`,
            [users.rows[0].id, marker.name]
        );
        return collections.rowCount > 0 ? "seeded" : "partial";
    } finally {
        await client.end();
    }
}

/** Seeding: the plan, through the same public API routes the UI uses */
async function seedThroughApi() {
    const sessions = {};
    for (const [user, { username, password }] of Object.entries(USERS)) {
        console.log(`Signing up ${username}`);
        sessions[user] = await Api.signUp(baseUrl, username, password);
    }

    for (const planned of COLLECTIONS) {
        const api = sessions[planned.owner];
        console.log(`Creating ${planned.owner}'s collection '${planned.name}'`);
        const collectionId = await api.createCollection(planned);
        if (planned.files.length > 0) {
            const files = await Promise.all(
                planned.files.map(async (file) => {
                    const sample = SAMPLES[file.sample];
                    return {
                        name: fileName(file),
                        mimeType: sample.mimeType,
                        content: await sample.content(),
                        lastModified: new Date(file.lastModified)
                    };
                })
            );
            console.log(`  uploading ${files.length} file(s)`);
            await api.upload(collectionId, files);
        }
    }
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

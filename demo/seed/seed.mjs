// Seeds an empty demo with the scenario plan, then checks every scenario is
// there. Does nothing when the demo is already seeded, so data made while
// testing survives. Runs in the demo's seed service once the app is healthy:
//
//   HOLVI_DEMO_URL=http://app:3000 \
//   HOLVI_DEMO_DB_CONNECTION_STRING=postgres://... node demo/seed/seed.mjs
//
// Exits non-zero, naming what failed, when seeding or any check fails.

import pg from "pg";
import { Api } from "./api.mjs";
import { CHECKS } from "./checks.mjs";
import { MEDIA } from "./media.mjs";
import { COLLECTIONS, USERS, fileName } from "./plan.mjs";

const baseUrl = requireEnv("HOLVI_DEMO_URL");
const connectionString = requireEnv("HOLVI_DEMO_DB_CONNECTION_STRING");

try {
    if (await isSeeded()) {
        console.log(
            `User '${USERS.demo.username}' exists: the demo is already seeded`
        );
        process.exit(0);
    }
} catch (error) {
    fail("Could not tell whether the demo is seeded", error);
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

/** Whether User demo exists, read straight from the database */
async function isSeeded() {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
        const { rows } = await client.query(
            `SELECT to_regclass('"Users"') IS NOT NULL AS "hasUsers"`
        );
        if (!rows[0].hasUsers) {
            return false;
        }
        const { rowCount } = await client.query(
            `SELECT 1 FROM "Users" WHERE username = $1`,
            [USERS.demo.username]
        );
        return rowCount > 0;
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
                    const sample = MEDIA[file.media];
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

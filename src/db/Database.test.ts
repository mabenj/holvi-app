import { beforeEach, describe, expect, it } from "vitest";
import { getTestDatabase, resetDatabase } from "../../test/database";

describe("Database (integration)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("initialises the schema and persists rows in the test database", async () => {
        const db = await getTestDatabase();

        await db.models.User.create({
            username: "alice",
            hash: "hash",
            salt: "salt"
        });

        const users = await db.models.User.findAll();
        expect(users.map((user) => user.username)).toEqual(["alice"]);
    });

    it("starts each test from an empty database", async () => {
        const db = await getTestDatabase();

        expect(await db.models.User.count()).toBe(0);
    });
});

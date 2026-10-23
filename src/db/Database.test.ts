import Database from "@/db/Database";
import { DatabaseInfo } from "@/db/models/DatabaseInfo";
import { beforeEach, describe, expect, it } from "vitest";
import {
    addFile,
    createCollection,
    createUser
} from "../../test/fixtures";
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

    it("reports version 7 after start", async () => {
        await getTestDatabase();

        const info = await DatabaseInfo.findByPk(1);
        expect(info?.version).toBe(7);
    });

    it("upgrades a version 5 database to version 7 without changing its data", async () => {
        const db = await getTestDatabase();
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday", {
            tags: ["summer"]
        });
        await addFile(user.id, holiday.id, "beach.jpg", Buffer.from("beach"), {
            tags: ["sea"]
        });
        const snapshot = () =>
            Promise.all(
                Object.values(db.models).map((model) =>
                    db.select(`SELECT * FROM "${model.getTableName()}"`)
                )
            );
        const before = await snapshot();
        await DatabaseInfo.update({ version: 5 }, { where: { id: 1 } });

        await Database.ensureUpToDate();

        expect((await DatabaseInfo.findByPk(1))?.version).toBe(7);
        expect(await snapshot()).toEqual(before);
    });

    it("upgrades a version 6 database to version 7 with every existing file's thumbnail ready", async () => {
        const db = await getTestDatabase();
        const user = await createUser("alice");
        const holiday = await createCollection(user.id, "Holiday");
        const beach = await addFile(
            user.id,
            holiday.id,
            "beach.jpg",
            Buffer.from("beach")
        );
        // The schema of version 6, which had no thumbnail state
        const queryInterface = db.models.CollectionFile.sequelize!.getQueryInterface();
        await queryInterface.removeColumn("CollectionFiles", "thumbnailStatus");
        await queryInterface.removeColumn("CollectionFiles", "thumbnailError");
        await DatabaseInfo.update({ version: 6 }, { where: { id: 1 } });

        // As on start: the models are synced, then the database is upgraded
        await db.models.CollectionFile.sync({ alter: true });
        await Database.ensureUpToDate();

        expect((await DatabaseInfo.findByPk(1))?.version).toBe(7);
        expect(
            await db.models.CollectionFile.findByPk(beach.id, {
                attributes: ["thumbnailStatus", "thumbnailError"],
                raw: true
            })
        ).toEqual({ thumbnailStatus: "ready", thumbnailError: null });
    });
});

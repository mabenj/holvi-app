import { Sequelize } from "sequelize";
import { describe, expect, it } from "vitest";
import { BackupJob } from "./BackupJob";
import { Collection } from "./Collection";
import { CollectionFile } from "./CollectionFile";
import { CollectionFileTag } from "./CollectionFileTag";
import { CollectionTag } from "./CollectionTag";
import { DatabaseInfo } from "./DatabaseInfo";
import { Tag } from "./Tag";
import { User } from "./User";

// Existing databases have these tables; association foreign keys and index
// names are derived from the model names too.
const expectedNames = [
    [DatabaseInfo, "DatabaseInfo", "DatabaseInfos"],
    [User, "User", "Users"],
    [Collection, "Collection", "Collections"],
    [CollectionFile, "CollectionFile", "CollectionFiles"],
    [Tag, "Tag", "Tags"],
    [CollectionTag, "CollectionTag", "CollectionTags"],
    [CollectionFileTag, "CollectionFileTag", "CollectionFileTags"],
    [BackupJob, "BackupJob", "BackupJobs"]
] as const;

describe("model names", () => {
    it("don't depend on the class names, which the production build minifies", () => {
        // Nothing connects: defining models needs no database
        const sequelize = new Sequelize("postgres://user:pass@localhost/none", {
            logging: false
        });
        for (const [model] of expectedNames) {
            // What minification does to a class name
            Object.defineProperty(model, "name", { value: "h" });
            model.initModel(sequelize);
        }

        expect(
            expectedNames.map(([model]) => [model.name, model.getTableName()])
        ).toEqual(expectedNames.map(([, name, table]) => [name, table]));
    });
});

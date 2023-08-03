import appConfig from "@/lib/common/app-config";
import { HolviError } from "@/lib/common/errors";
import { ImageHelper } from "@/lib/common/image-helper";
import Log, { LogColor } from "@/lib/common/log";
import { getErrorMessage } from "@/lib/common/utilities";
import { readFile } from "fs/promises";
import path from "path";
import Database from "./Database";

type UpgradeFunction = (db: Database) => Promise<void>;

export default class DatabaseUpgrade {
    private static readonly logger = new Log("DB-UPGRADE", LogColor.MAGENTA);
    private static readonly upgradeFunctions: Record<number, UpgradeFunction> =
        {
            1: DatabaseUpgrade.performUpgrade1,
            2: DatabaseUpgrade.performUpgrade2,
            3: DatabaseUpgrade.performUpgrade3
        };

    static async upgrade(from: number, to: number, db: Database) {
        while (from < to) {
            DatabaseUpgrade.logger.info(
                `Upgrading database from version ${from} to ${from + 1}`
            );
            try {
                await DatabaseUpgrade.step(from, db);
                from++;
            } catch (error) {
                DatabaseUpgrade.logger.error(
                    `Error upgrading database from version ${from} to ${
                        from + 1
                    }`,
                    error
                );
                throw error;
            }
        }
    }

    private static async step(fromVersion: number, db: Database) {
        const upgradeFn = DatabaseUpgrade.upgradeFunctions[fromVersion];
        if (typeof upgradeFn !== "function") {
            throw new HolviError(
                `No upgrade function exists for version '${fromVersion}'`
            );
        }
        await upgradeFn(db);
    }

    private static async performUpgrade1(db: Database) {
        const transaction = await db.transaction();
        try {
            const files = await db.models.CollectionFile.findAll({
                where: {
                    blurDataUrl: null
                },
                include: db.models.Collection
            });
            for (let i = 0; i < files.length; i++) {
                const userId = files[i].Collection?.UserId || "";
                const collectionId = files[i].CollectionId;
                const fileId = files[i].id;
                DatabaseUpgrade.logger.info(
                    `Generating placeholder for '${fileId}'`
                );

                const thumbnailPath = path.join(
                    appConfig.dataDir,
                    userId,
                    collectionId,
                    "tn",
                    fileId
                );
                const buffer = await readFile(thumbnailPath);
                const base64 = await ImageHelper.generateBlur(buffer);

                files[i].blurDataUrl = base64;
            }

            DatabaseUpgrade.logger.info("Inserting files back into database");
            const result = await db.models.CollectionFile.bulkCreate(
                files.map((file) => file.toJSON()),
                {
                    updateOnDuplicate: ["blurDataUrl"]
                }
            );
            DatabaseUpgrade.logger.info(`${result.length} rows affected`);
        } catch (error) {
            DatabaseUpgrade.logger.error(
                `Error generating placeholders (${getErrorMessage(error)})`
            );
            await transaction.rollback();
        }
    }

    private static async performUpgrade2(db: Database) {
        throw new Error("Not implemented");
    }

    private static async performUpgrade3(db: Database) {
        throw new Error("Not implemented");
    }
}

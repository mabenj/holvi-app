import appConfig from "@/lib/common/app-config";
import Cryptography from "@/lib/common/cryptography";
import { HolviError } from "@/lib/common/errors";
import { ImageHelper } from "@/lib/common/image-helper";
import Log, { LogColor } from "@/lib/common/log";
import { getErrorMessage } from "@/lib/common/utilities";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import Database from "./Database";

type UpgradeFunction = (db: Database) => Promise<boolean>;

export default class DatabaseUpgrade {
    private static readonly logger = new Log("DB-UPGRADE", LogColor.MAGENTA);
    private static readonly upgradeFunctions: Record<number, UpgradeFunction> =
        {
            1: DatabaseUpgrade.performUpgrade1,
            2: DatabaseUpgrade.performUpgrade2
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
        const isSuccess = await upgradeFn(db);
        if (isSuccess) {
            return;
        }
        throw new HolviError(`Upgrade unsuccessful`);
    }

    private static async performUpgrade1(db: Database): Promise<boolean> {
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
                    `Generating placeholder ${i + 1}/${
                        files.length
                    } (${fileId})`
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

            return true;
        } catch (error) {
            DatabaseUpgrade.logger.error(
                `Error generating placeholders (${getErrorMessage(error)})`
            );
            await transaction.rollback();
            return false;
        }
    }

    private static async performUpgrade2(db: Database): Promise<boolean> {
        const files = await db.models.CollectionFile.findAll({
            include: db.models.Collection
        });

        const backupDir = path.join(
            appConfig.dataDir,
            "db_upgrade_2_to_3_backup"
        );

        try {
            for (let i = 0; i < files.length; i++) {
                const userId = files[i].Collection!.UserId;
                const collectionId = files[i].CollectionId;
                const fileId = files[i].id;
                DatabaseUpgrade.logger.info(
                    `Encrypting file ${i + 1}/${files.length} (${fileId})`
                );

                await backupAndEncryptFile(userId, collectionId, fileId);
                await backupAndEncryptFile(userId, collectionId, fileId, true);
            }

            DatabaseUpgrade.logger.info(
                "All files encrypted. Deleting backup..."
            );
            await rm(backupDir, { recursive: true, force: true });
            DatabaseUpgrade.logger.info("Done");

            return true;
        } catch (error) {
            DatabaseUpgrade.logger.error(
                `Error encrypting files (${getErrorMessage(error)})`,
                error
            );
            DatabaseUpgrade.logger.info(
                `So far processed files are backed up in '${backupDir}'`
            );
            return false;
        }

        async function backupAndEncryptFile(
            userId: string,
            collectionId: string,
            fileId: string,
            isThumbnail: boolean = false
        ) {
            const filepath = [userId, collectionId];
            if (isThumbnail) {
                filepath.push("tn");
            }
            filepath.push(fileId);

            const originalPath = path.join(appConfig.dataDir, ...filepath);
            const backupPath = path.join(backupDir, ...filepath);
            await mkdir(path.dirname(backupPath), { recursive: true });

            const file = await readFile(originalPath);
            await writeFile(backupPath, file);
            await writeFile(originalPath, Cryptography.encrypt(file));
        }
    }
}

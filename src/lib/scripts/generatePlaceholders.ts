import { loadEnvConfig } from "@next/env";
import { readFile } from "fs/promises";
import path from "path";
import Log, { LogColor } from "../common/log";
import { getErrorMessage } from "../common/utilities";

async function main() {
    const logger = new Log("SCRIPT", LogColor.RED);

    // imported here because otherwise the environment variables (required by
    // these modules) would not be loaded and errors would be raised
    const { default: Database } = await import("@/db/Database");
    const { default: appConfig } = await import("../common/app-config");
    const { ImageHelper } = await import("../common/image-helper");

    const db = await Database.getInstance();
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
            logger.info(`Generating placeholder for '${fileId}'`);

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

        logger.info("Inserting files back into database");
        const result = await db.models.CollectionFile.bulkCreate(
            files.map((file) => file.toJSON()),
            {
                updateOnDuplicate: ["blurDataUrl"]
            }
        );
        logger.info(`${result.length} rows affected`);
    } catch (error) {
        logger.error(
            `Error generating placeholders (${getErrorMessage(error)})`
        );
        await transaction.rollback();
    } finally {
        await db.close();
    }
}

loadEnvConfig("./", true);
main();

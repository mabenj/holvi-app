import { HolviError } from "@/lib/common/errors";
import Log, { LogColor } from "@/lib/common/log";
import Database from "./Database";

type UpgradeFunction = (db: Database) => Promise<number>;

export default class DatabaseUpgrade {
    private static readonly logger = new Log("DB-UPGRADE", LogColor.GREEN);
    private static readonly upgradeFunctions: Record<number, UpgradeFunction> =
        {
            1: performUpgrade1,
            2: performUpgrade2,
            3: performUpgrade3
        };

    static async upgrade(from: number, to: number, db: Database) {
        if (from === to) {
            return;
        }

        while (from < to) {
            DatabaseUpgrade.logger.info(
                `Upgrading database from version ${from} to ${from + 1}`
            );
            try {
                from = await DatabaseUpgrade.step(from, db);
            } catch (error) {
                DatabaseUpgrade.logger.error(
                    `Error upgrading database from version ${from} to ${to}`,
                    error
                );
                throw error;
            }
        }
    }

    private static async step(
        fromVersion: number,
        db: Database
    ): Promise<number> {
        const upgradeFn = DatabaseUpgrade.upgradeFunctions[fromVersion];
        if (typeof upgradeFn !== "function") {
            throw new HolviError(
                `No upgrade function exists for version '${fromVersion}'`
            );
        }
        return upgradeFn(db);
    }
}

async function performUpgrade1(db: Database) {
    return 2;
}

async function performUpgrade2(db: Database) {
    return 3;
}

async function performUpgrade3(db: Database) {
    return 4;
}

import Log from "@/lib/common/log";
import { getErrorMessage } from "@/lib/common/utilities";
import pgp from "pg-promise";
import pg from "pg-promise/typescript/pg-subset";

export default class Database {
    private static db: pgp.IDatabase<{}, pg.IClient>;

    static async sql<T = any>(text: string, values?: any[]): Promise<T[]> {
        try {
            return Database.getDb().any<T>({
                text,
                values
            });
        } catch (error) {
            Log.error(`Database error: ${getErrorMessage(error)}`);
            return Promise.reject("Database error");
        }
    }

    static sqlOne<T = any>(text: string, values?: any[]): Promise<T | null> {
        try {
            return Database.getDb().oneOrNone<T>({
                text,
                values
            });
        } catch (error) {
            Log.error(`Database error: ${getErrorMessage(error)}`);
            return Promise.reject("Database error");
        }
    }

    static bulkInsert<T = any>(
        table: string,
        rows: Record<string, any>[],
        returnColumns?: string[]
    ): Promise<T[]> {
        if (rows.length < 1) {
            return Promise.resolve([]);
        }
        const insertQuery = pgp().helpers.insert(
            rows,
            Object.keys(rows[0]),
            table
        );
        try {
            return Database.sql(
                insertQuery +
                    (returnColumns
                        ? ` RETURNING ${returnColumns?.join(", ")}`
                        : " RETURNING *")
            );
        } catch (error) {
            Log.error(`Database error: ${getErrorMessage(error)}`);
            return Promise.reject("Database error");
        }
    }

    private static getDb() {
        if (!process.env.DB_CONNECTION_STRING) {
            throw new Error(
                "Database connection string is not defined (use environment variable 'DB_CONNECTION_STRING')"
            );
        }
        if (!this.db) {
            Log.info("Connecting to database");
            this.db = pgp()(process.env.DB_CONNECTION_STRING);
        }
        return this.db;
    }
}

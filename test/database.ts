import Database from "@/db/Database";

/**
 * Connects to the test Postgres database, initialising the schema on first use.
 * Fails loudly instead of letting tests run against an uninitialised database.
 */
export async function getTestDatabase() {
    const databaseName = new URL(process.env.HOLVI_DB_CONNECTION_STRING!)
        .pathname.slice(1);
    if (!databaseName.endsWith("test")) {
        throw new Error(
            `Refusing to run integration tests against database '${databaseName}': its name must end with 'test'`
        );
    }

    const db = await Database.getInstance();
    if (!db.isInitialized()) {
        throw new Error(
            `Could not initialise test database at '${process.env.HOLVI_DB_CONNECTION_STRING}'. Is the test Postgres container running? See README.`
        );
    }
    return db;
}

/** Deletes all rows from every application table. */
export async function resetDatabase() {
    const db = await getTestDatabase();
    const models = Object.values(db.models);
    const tableNames = models.map((model) => `"${model.getTableName()}"`);
    await models[0].sequelize!.query(
        `TRUNCATE ${tableNames.join(", ")} CASCADE`
    );
}

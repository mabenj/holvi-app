import Log from "@/lib/common/log";
import { Sequelize, Transaction } from "sequelize";
import { Collection } from "./models/Collection";
import { CollectionFile } from "./models/CollectionFile";
import { Tag } from "./models/Tag";
import { User } from "./models/User";

export default class Database {
    private static instance: Database;
    private readonly sequelize;

    public get models() {
        return {
            User: User,
            Collection: Collection,
            CollectionFile: CollectionFile,
            Tag: Tag
        };
    }

    private constructor() {
        if (!process.env.DB_CONNECTION_STRING) {
            throw new Error(
                "Database connection string is not defined (use environment variable 'DB_CONNECTION_STRING')"
            );
        }
        this.sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
            benchmark: true,
            logging: false
        });
    }

    public transaction() {
        return this.sequelize.transaction();
    }

    public static async getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
            await this.init();
        }
        return Database.instance;
    }

    public static async withTransaction<T>(
        handler: (transaction: Transaction, db: Database) => Promise<T>
    ) {
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        try {
            const result = await handler(transaction, db);
            transaction.commit();
            return result;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    private static async init() {
        try {
            await Database.instance.sequelize.authenticate();
            Log.info("Database connection established");
        } catch (error) {
            Log.error("Unable to connect to the database", error);
            return;
        }

        try {
            User.initModel(Database.instance.sequelize);
            Collection.initModel(Database.instance.sequelize);
            CollectionFile.initModel(Database.instance.sequelize);
            Tag.initModel(Database.instance.sequelize);

            User.hasMany(Collection);
            Collection.belongsTo(User, {
                foreignKey: {
                    allowNull: false
                }
            });
            Collection.hasMany(CollectionFile, { onDelete: "CASCADE" });
            Collection.hasMany(Tag, { onDelete: "CASCADE" });
            CollectionFile.belongsTo(Collection, {
                foreignKey: {
                    allowNull: false
                }
            });
            CollectionFile.hasMany(Tag, { onDelete: "CASCADE" });
            Tag.belongsTo(Collection);
            Tag.belongsTo(CollectionFile);

            Log.info("Initializing models");
            await Database.instance.sequelize.sync({ alter: true });

            Log.info("Database initialized");
        } catch (error) {
            Log.error("Error initializing models", error);
            return;
        }
    }
}

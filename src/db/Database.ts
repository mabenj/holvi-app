import appConfig from "@/lib/common/app-config";
import Log from "@/lib/common/log";
import { sleep } from "@/lib/common/utilities";
import { Sequelize, Transaction } from "sequelize";
import { Collection } from "./models/Collection";
import { CollectionFile } from "./models/CollectionFile";
import { Tag } from "./models/Tag";
import { User } from "./models/User";

export default class Database {
    private static instance: Database;
    private readonly sequelize;
    private initializing = false;

    public get models() {
        return {
            User: User,
            Collection: Collection,
            CollectionFile: CollectionFile,
            Tag: Tag
        };
    }

    private constructor() {
        this.sequelize = new Sequelize(appConfig.connectionString, {
            benchmark: true,
            logging: false
        });
    }

    public transaction() {
        return this.sequelize.transaction();
    }

    public static async getInstance() {
        while (Database.instance?.initializing) {
            await sleep(100);
        }
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
        Database.instance.initializing = true;
        try {
            await Database.instance.sequelize.authenticate();
            Log.info("Database connection established");
        } catch (error) {
            Log.error("Unable to connect to the database", error);
            Database.instance.initializing = false;
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
        } finally {
            Database.instance.initializing = false;
        }
    }
}

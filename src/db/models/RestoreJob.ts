import { BackupProblem } from "@/lib/types/backup-job-dto";
import {
    RestoreJobDto,
    RestoreJobStatus,
    UnrestoredFile
} from "@/lib/types/restore-job-dto";
import {
    CreationOptional,
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";
import { User } from "./User";

export class RestoreJob extends Model<
    InferAttributes<RestoreJob>,
    InferCreationAttributes<RestoreJob>
> {
    declare id: CreationOptional<string>;
    declare status: RestoreJobStatus;
    declare sourceId: string;
    declare sourceName: string;
    /** The zip it reads, resolved when the job was queued */
    declare zipPath: string;
    /** The zip's size and modification time when the job was queued, to tell whether it changed since */
    declare zipSizeBytes: number;
    declare zipModifiedAt: Date;
    /** Every collection the Backup holds, so the files a job wrote can be found without the zip */
    declare collectionIds: string[];
    declare queuedAt: Date;
    declare startedAt: CreationOptional<Date | null>;
    declare finishedAt: CreationOptional<Date | null>;
    declare collectionsDone: CreationOptional<number>;
    declare collectionsTotal: CreationOptional<number>;
    declare filesDone: CreationOptional<number>;
    declare filesTotal: CreationOptional<number>;
    declare bytesDone: CreationOptional<number>;
    declare bytesTotal: CreationOptional<number>;
    declare currentFileName: CreationOptional<string | null>;
    declare unrestoredFiles: CreationOptional<UnrestoredFile[]>;
    declare problems: CreationOptional<BackupProblem[]>;
    declare errorMessage: CreationOptional<string | null>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare UserId: ForeignKey<User["id"]>;

    static initModel(sequelize: Sequelize) {
        // Each attribute needs its own definition object: Sequelize mutates them
        const counter = () => ({
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        });
        const byteCounter = (
            field: "bytesDone" | "bytesTotal" | "zipSizeBytes"
        ) => ({
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            get(this: RestoreJob) {
                // Postgres returns BIGINT as a string
                return Number(this.getDataValue(field));
            }
        });
        const list = () => ({
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        });

        RestoreJob.init(
            {
                id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue: DataTypes.UUIDV4
                },
                status: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                sourceId: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                sourceName: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                zipPath: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                zipSizeBytes: byteCounter("zipSizeBytes"),
                zipModifiedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                collectionIds: list(),
                queuedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                startedAt: DataTypes.DATE,
                finishedAt: DataTypes.DATE,
                collectionsDone: counter(),
                collectionsTotal: counter(),
                filesDone: counter(),
                filesTotal: counter(),
                bytesDone: byteCounter("bytesDone"),
                bytesTotal: byteCounter("bytesTotal"),
                currentFileName: DataTypes.TEXT,
                unrestoredFiles: list(),
                problems: list(),
                errorMessage: DataTypes.TEXT,
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize,
                // Named explicitly: the production build minifies class names
                modelName: "RestoreJob",
                tableName: "RestoreJobs"
            }
        );
    }

    toDto(): RestoreJobDto {
        return {
            id: this.id,
            status: this.status,
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            queuedAt: this.queuedAt.getTime(),
            startedAt: this.startedAt?.getTime() ?? null,
            finishedAt: this.finishedAt?.getTime() ?? null,
            progress: {
                collectionsDone: this.collectionsDone,
                collectionsTotal: this.collectionsTotal,
                filesDone: this.filesDone,
                filesTotal: this.filesTotal,
                bytesDone: this.bytesDone,
                bytesTotal: this.bytesTotal,
                currentFileName: this.currentFileName
            },
            unrestoredFiles: this.unrestoredFiles,
            problems: this.problems,
            errorMessage: this.errorMessage
        };
    }
}

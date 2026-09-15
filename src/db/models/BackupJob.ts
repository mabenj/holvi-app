import { BackupJobDto, BackupJobStatus } from "@/lib/types/backup-job-dto";
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

export class BackupJob extends Model<
    InferAttributes<BackupJob>,
    InferCreationAttributes<BackupJob>
> {
    declare id: CreationOptional<string>;
    declare status: BackupJobStatus;
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
    declare zipFileName: CreationOptional<string | null>;
    declare zipSizeBytes: CreationOptional<number | null>;
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
        const byteCounter = (field: "bytesDone" | "bytesTotal") => ({
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            get(this: BackupJob) {
                // Postgres returns BIGINT as a string
                return Number(this.getDataValue(field));
            }
        });

        BackupJob.init(
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
                zipFileName: DataTypes.STRING,
                zipSizeBytes: {
                    type: DataTypes.BIGINT,
                    get(this: BackupJob) {
                        const value = this.getDataValue("zipSizeBytes");
                        return value === null ? null : Number(value);
                    }
                },
                errorMessage: DataTypes.TEXT,
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize
            }
        );
    }

    toDto(): BackupJobDto {
        return {
            id: this.id,
            status: this.status,
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
            zipFileName: this.zipFileName,
            zipSizeBytes: this.zipSizeBytes,
            errorMessage: this.errorMessage
        };
    }
}

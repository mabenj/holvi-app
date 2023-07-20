import { getFileSrc } from "@/lib/common/utilities";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import {
    CreationOptional,
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    NonAttribute,
    Sequelize
} from "sequelize";
import { Collection } from "./Collection";
import { Tag } from "./Tag";

export class CollectionFile extends Model<
    InferAttributes<CollectionFile>,
    InferCreationAttributes<CollectionFile>
> {
    declare id: CreationOptional<string>;
    declare label: string;
    declare mimeType: string;
    declare width?: number;
    declare height?: number;
    declare thumbnailWidth?: number;
    declare thumbnailHeight?: number;
    declare gpsLatitude?: CreationOptional<number>;
    declare gpsLongitude?: CreationOptional<number>;
    declare gpsAltitude?: CreationOptional<number>;
    declare takenAt?: CreationOptional<Date>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare CollectionId: ForeignKey<Collection["id"]>;

    declare Tags?: NonAttribute<Tag[]>;

    static initModel(sequelize: Sequelize) {
        CollectionFile.init(
            {
                id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue: DataTypes.UUIDV4
                },
                label: {
                    type: DataTypes.CITEXT,
                    allowNull: false
                },
                mimeType: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                width: {
                    type: DataTypes.INTEGER
                },
                height: {
                    type: DataTypes.INTEGER
                },
                thumbnailWidth: {
                    type: DataTypes.INTEGER
                },
                thumbnailHeight: {
                    type: DataTypes.INTEGER
                },
                takenAt: {
                    type: DataTypes.DATE
                },
                gpsLatitude: {
                    type: DataTypes.DECIMAL
                },
                gpsLongitude: {
                    type: DataTypes.DECIMAL
                },
                gpsAltitude: {
                    type: DataTypes.DECIMAL
                },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize
            }
        );
    }

    toDto(): CollectionFileDto {
        const gps =
            this.gpsLatitude && this.gpsLongitude
                ? {
                      lat: this.gpsLatitude,
                      long: this.gpsLongitude,
                      alt: this.gpsAltitude
                  }
                : undefined;
        return {
            id: this.id,
            collectionId: this.CollectionId,
            name: this.label,
            mimeType: this.mimeType,
            src: getFileSrc({
                collectionId: this.CollectionId,
                fileId: this.id,
                mimeType: this.mimeType
            }),
            width: this.width,
            height: this.height,
            thumbnailSrc: getFileSrc({
                collectionId: this.CollectionId,
                fileId: this.id,
                mimeType: this.mimeType,
                thumbnail: true
            }),
            thumbnailWidth: this.thumbnailWidth,
            thumbnailHeight: this.thumbnailHeight,
            tags: this.Tags?.map((tag) => tag.name) || [],
            timestamp: (this.takenAt || this.createdAt).getTime(),
            gps: gps
        };
    }
}

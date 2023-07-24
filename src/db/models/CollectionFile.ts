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
    declare name: string;
    declare mimeType: string;
    declare width?: number;
    declare height?: number;
    declare thumbnailWidth?: number;
    declare thumbnailHeight?: number;
    declare gpsLatitude?: CreationOptional<number>;
    declare gpsLongitude?: CreationOptional<number>;
    declare gpsAltitude?: CreationOptional<number>;
    declare gpsLabel?: CreationOptional<string>;
    declare takenAt?: CreationOptional<Date>;
    declare durationInSeconds?: CreationOptional<number>;

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
                name: {
                    type: DataTypes.CITEXT,
                    allowNull: false
                },
                mimeType: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                width: DataTypes.INTEGER,
                height: DataTypes.INTEGER,
                thumbnailWidth: DataTypes.INTEGER,
                thumbnailHeight: DataTypes.INTEGER,
                takenAt: DataTypes.DATE,
                durationInSeconds: DataTypes.INTEGER,
                gpsLatitude: DataTypes.DECIMAL,
                gpsLongitude: DataTypes.DECIMAL,
                gpsAltitude: DataTypes.DECIMAL,
                gpsLabel: DataTypes.STRING,
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
                      alt: this.gpsAltitude,
                      label: this.gpsLabel
                  }
                : undefined;
        return {
            id: this.id,
            collectionId: this.CollectionId,
            name: this.name,
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
            gps: gps,
            durationInSeconds: this.durationInSeconds
        };
    }
}

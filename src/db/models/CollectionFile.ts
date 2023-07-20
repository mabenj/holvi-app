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
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize
            }
        );
    }

    toDto(): CollectionFileDto {
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
            createdAt: this.createdAt.getTime(),
            updatedAt: this.updatedAt.getTime()
        };
    }
}

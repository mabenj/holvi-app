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
    declare path: string;
    declare width?: number;
    declare height?: number;
    declare thumbnailPath?: string;
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
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                mimeType: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                path: {
                    type: DataTypes.CITEXT,
                    unique: true,
                    allowNull: false
                },
                width: {
                    type: DataTypes.INTEGER
                },
                height: {
                    type: DataTypes.INTEGER
                },
                thumbnailPath: {
                    type: DataTypes.CITEXT,
                    unique: true
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
}

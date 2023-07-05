import {
    CreationOptional,
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";
import { Collection } from "./Collection";
import { CollectionFile } from "./CollectionFile";
import { User } from "./User";

export class Tag extends Model<
    InferAttributes<Tag>,
    InferCreationAttributes<Tag>
> {
    declare id: CreationOptional<number>;
    declare name: string;

    declare UserId?: ForeignKey<User["id"]>
    declare CollectionId?: ForeignKey<Collection["id"]>
    declare CollectionFileId?: ForeignKey<CollectionFile["id"]>

    static initModel(sequelize: Sequelize) {
        Tag.init(
            {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                }
            },
            {
                sequelize
            }
        );
    }
}

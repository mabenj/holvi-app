import {
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    NonAttribute,
    Sequelize
} from "sequelize";
import { Collection } from "./Collection";
import { CollectionFile } from "./CollectionFile";

export class Tag extends Model<
    InferAttributes<Tag>,
    InferCreationAttributes<Tag>
> {
    declare name: string;

    declare CollectionFiles?: NonAttribute<CollectionFile[]>;
    declare Collections?: NonAttribute<Collection[]>;

    static initModel(sequelize: Sequelize) {
        Tag.init(
            {
                name: {
                    type: DataTypes.CITEXT,
                    primaryKey: true
                }
            },
            {
                sequelize
            }
        );
    }
}

import {
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";
import { Collection } from "./Collection";
import { Tag } from "./Tag";

/**
 * Junction model for Collection and Tag models
 */
export class CollectionTag extends Model<
    InferAttributes<CollectionTag>,
    InferCreationAttributes<CollectionTag>
> {
    declare CollectionId: ForeignKey<Collection["id"]>;
    declare TagName: ForeignKey<Tag["name"]>;

    static initModel(sequelize: Sequelize) {
        CollectionTag.init(
            {
                CollectionId: {
                    type: DataTypes.UUIDV4,
                    references: {
                        model: Collection,
                        key: "id"
                    }
                },
                TagName: {
                    type: DataTypes.CITEXT,
                    references: {
                        model: Tag,
                        key: "name"
                    }
                }
            },
            { sequelize }
        );
    }
}

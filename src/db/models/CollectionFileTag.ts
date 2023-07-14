import {
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";
import { CollectionFile } from "./CollectionFile";
import { Tag } from "./Tag";

/**
 * Junction model for CollectionFile and Tag models
 */
export class CollectionFileTag extends Model<
    InferAttributes<CollectionFileTag>,
    InferCreationAttributes<CollectionFileTag>
> {
    declare CollectionFileId: ForeignKey<CollectionFile["id"]>;
    declare TagName: ForeignKey<Tag["name"]>;

    static initModel(sequelize: Sequelize) {
        CollectionFileTag.init(
            {
                CollectionFileId: {
                    type: DataTypes.UUIDV4,
                    references: {
                        model: CollectionFile,
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

import { getFileSrc } from "@/lib/common/utilities";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
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
import { CollectionFile } from "./CollectionFile";
import { Tag } from "./Tag";
import { User } from "./User";

export class Collection extends Model<
    InferAttributes<Collection>,
    InferCreationAttributes<Collection>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare description?: CreationOptional<string>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare UserId: ForeignKey<User["id"]>;

    declare Tags?: NonAttribute<Tag[]>;
    declare CollectionFiles?: NonAttribute<CollectionFile[]>;

    static initModel(sequelize: Sequelize) {
        Collection.init(
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
                description: {
                    type: DataTypes.STRING
                },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize
            }
        );
    }

    toDto(): CollectionDto {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            tags: this.Tags?.map((tag) => tag.name) || [],
            thumbnails:
                this.CollectionFiles?.map((file) =>
                    getFileSrc({
                        collectionId: this.id,
                        fileId: file.id,
                        mimeType: file.mimeType,
                        thumbnail: true
                    })
                ) || [],
            timestamp: this.createdAt.getTime()
        };
    }
}

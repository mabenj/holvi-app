import { caseInsensitiveSorter, getFileSrc } from "@/lib/common/utilities";
import { CollectionDto } from "@/lib/types/collection-dto";
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
    public static readonly thumbnailsLimit = 10;

    declare id: CreationOptional<string>;
    declare name: string;
    declare description: CreationOptional<string | null>;
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
                    type: DataTypes.CITEXT,
                    allowNull: false
                },
                description: DataTypes.STRING,
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE
            },
            {
                sequelize
            }
        );
    }

    toDto(): CollectionDto {
        const thumbnails =
            this.CollectionFiles?.sort(caseInsensitiveSorter("name")).slice(
                0,
                Collection.thumbnailsLimit
            ) || [];

        return {
            id: this.id,
            name: this.name,
            description: this.description || "",
            tags: this.Tags?.map((tag) => tag.name) || [],
            thumbnails: thumbnails.map((file) =>
                getFileSrc({
                    collectionId: this.id,
                    fileId: file.id,
                    mimeType: file.mimeType,
                    thumbnail: true
                })
            ),
            timestamp: this.createdAt.getTime(),
            videoCount:
                this.CollectionFiles?.filter((file) =>
                    file.mimeType.includes("video")
                ).length || 0,
            imageCount:
                this.CollectionFiles?.filter((file) =>
                    file.mimeType.includes("image")
                ).length || 0,
            blurDataUrl: thumbnails[0]?.blurDataUrl || null
        };
    }
}

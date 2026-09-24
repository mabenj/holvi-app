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
    /** The number of Opens the collection has had */
    declare openCount: CreationOptional<number>;
    /** When the collection was last opened; null if never */
    declare lastOpened: CreationOptional<Date | null>;
    /**
     * The file the user chose as the Cover; null for the automatic Cover.
     * No foreign key: it may name a file that is gone, which falls back to
     * the automatic Cover when collections are read.
     */
    declare coverFileId: CreationOptional<string | null>;

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
                updatedAt: DataTypes.DATE,
                // Collections and CollectionFiles referencing each other
                // would be a cycle that model sync cannot create
                coverFileId: DataTypes.UUID,
                openCount: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0
                },
                lastOpened: DataTypes.DATE
            },
            {
                sequelize,
                // Named explicitly: the production build minifies class names
                modelName: "Collection",
                tableName: "Collections",
                indexes: [
                    // Browsing reads one user's collections
                    { fields: ["UserId"] },
                    // Sorting by name pages through them by name
                    { fields: ["UserId", "name", "id"] }
                ]
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

import { getFileSrc } from "@/lib/common/utilities";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import {
    CreationOptional,
    DataTypes,
    ForeignKey,
    InferAttributes,
    InferCreationAttributes,
    literal,
    Model,
    NonAttribute,
    Sequelize
} from "sequelize";
import { Collection } from "./Collection";
import { Tag } from "./Tag";

/** Where a video is in video processing; null for a video never processed, and for images */
export type VideoProcessingStatusValue =
    | "pending"
    | "processing"
    | "done"
    | "failed";

export const VIDEO_PROCESSING_STATUSES: VideoProcessingStatusValue[] = [
    "pending",
    "processing",
    "done",
    "failed"
];

export class CollectionFile extends Model<
    InferAttributes<CollectionFile>,
    InferCreationAttributes<CollectionFile>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare mimeType: string;
    declare width: number | null;
    declare height: number | null;
    declare thumbnailWidth: number | null;
    declare thumbnailHeight: number | null;
    declare gpsLatitude: CreationOptional<number | null>;
    declare gpsLongitude: CreationOptional<number | null>;
    declare gpsAltitude: CreationOptional<number | null>;
    declare gpsLabel: CreationOptional<string | null>;
    declare takenAt: CreationOptional<Date | null>;
    declare durationInSeconds: CreationOptional<number | null>;
    declare blurDataUrl: CreationOptional<string | null>;
    declare processingStatus: CreationOptional<VideoProcessingStatusValue | null>;
    /** Why video processing last failed */
    declare processingError: CreationOptional<string | null>;
    /** Whether video processing stored a Rendition next to the original */
    declare hasRendition: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare CollectionId: ForeignKey<Collection["id"]>;

    declare Tags?: NonAttribute<Tag[]>;
    declare Collection?: NonAttribute<Collection>;

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
                updatedAt: DataTypes.DATE,
                blurDataUrl: DataTypes.TEXT,
                processingStatus: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    validate: { isIn: [VIDEO_PROCESSING_STATUSES] }
                },
                processingError: DataTypes.TEXT,
                hasRendition: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                }
            },
            {
                sequelize,
                indexes: [
                    // Collection summaries read each collection's first files
                    // by name, and a collection page pages through them by name
                    { fields: ["CollectionId", "name", "id"] },
                    // A collection page pages through its files by date: the
                    // taken-at time, or else the creation time
                    {
                        name: "collection_files_collection_id_date_id",
                        fields: [
                            "CollectionId",
                            literal(`COALESCE("takenAt", "createdAt")`),
                            "id"
                        ]
                    },
                    // The Timeline pages through every file by date, newest first
                    {
                        name: "collection_files_date_id",
                        fields: [
                            literal(`COALESCE("takenAt", "createdAt")`),
                            "id"
                        ]
                    },
                    // Last added to is the creation time of a collection's
                    // newest file, which most collection sorts order by
                    { fields: ["CollectionId", "createdAt"] },
                    // The video processing worker takes the oldest pending video
                    { fields: ["processingStatus", "createdAt", "id"] }
                ]
            }
        );
    }

    toDto(): CollectionFileDto {
        const gps =
            this.gpsLatitude && this.gpsLongitude
                ? {
                      lat: this.gpsLatitude,
                      long: this.gpsLongitude,
                      alt: this.gpsAltitude ?? undefined,
                      label: this.gpsLabel ?? undefined
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
            width: this.width ?? undefined,
            height: this.height ?? undefined,
            thumbnailSrc: getFileSrc({
                collectionId: this.CollectionId,
                fileId: this.id,
                mimeType: this.mimeType,
                thumbnail: true
            }),
            thumbnailWidth: this.thumbnailWidth ?? undefined,
            thumbnailHeight: this.thumbnailHeight ?? undefined,
            tags: this.Tags?.map((tag) => tag.name) || [],
            timestamp: (this.takenAt || this.createdAt).getTime(),
            gps: gps ?? undefined,
            durationInSeconds: this.durationInSeconds ?? undefined,
            blurDataUrl: this.blurDataUrl ?? undefined
        };
    }
}

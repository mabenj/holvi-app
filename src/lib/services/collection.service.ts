import Database from "@/db/Database";
import { ReadStream } from "fs";
import { IncomingMessage } from "http";
import { Op } from "sequelize";
import { UserFileSystem } from "../common/user-file-system";
import { EMPTY_UUIDV4, isUuidv4 } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";

const CHUNK_SIZE_BYTES = 3_000_000; // 3mb

interface CreateResult {
    collection?: CollectionDto;
    error?: string;
}

interface GetResult {
    collection?: CollectionDto;
    notFound?: boolean;
}

interface UpdateResult {
    collection?: CollectionDto;
    notFound?: boolean;
    error?: string;
}

interface DeleteResult {
    error?: string;
}

interface UploadResult {
    error?: string;
    files?: CollectionFileDto[];
}

interface GetFileResult {
    file?: Buffer;
    filename?: string;
    mimeType?: string;
    notFound?: boolean;
}

interface GetCollectionFilesResult {
    notFound?: boolean;
    collection?: CollectionDto;
    files?: CollectionFileDto[];
}

interface DeleteFileResult {
    error?: string;
}

interface GetStreamResult {
    stream?: ReadStream;
    chunkStartEnd?: [start: number, end: number];
    totalLengthBytes?: number;
    mimeType?: string;
    notFound?: boolean;
    filename?: string;
}

export class CollectionService {
    constructor(private readonly userId: string) {}

    async get(collectionId: string): Promise<GetResult> {
        if (!isUuidv4(collectionId)) {
            return {
                notFound: true
            };
        }
        const db = await Database.getInstance();
        const collection = await db.models.Collection.findOne({
            where: {
                id: collectionId,
                UserId: this.userId
            },
            include: db.models.Tag
        });
        if (!collection) {
            return {
                notFound: true
            };
        }
        return {
            collection: {
                id: collection.id,
                name: collection.name,
                tags: collection.Tags?.map((tag) => tag.name) || [],
                thumbnails: [],
                createdAt: collection.createdAt.getTime(),
                updatedAt: collection.updatedAt.getTime()
            }
        };
    }

    async deleteFile(
        collectionId: string,
        fileId: string
    ): Promise<DeleteFileResult> {
        if (!isUuidv4(collectionId) || !isUuidv4(fileId)) {
            return {
                error: "Invalid collection of file id"
            };
        }
        const db = await Database.getInstance();
        const transaction = await db.transaction();

        try {
            const collectionFile = await db.models.CollectionFile.findOne({
                where: {
                    id: fileId,
                    CollectionId: collectionId
                },
                include: {
                    model: db.models.Collection,
                    required: true,
                    where: {
                        UserId: this.userId
                    }
                }
            });
            if (!collectionFile) {
                return {};
            }
            collectionFile.destroy({ transaction });

            const fileSystem = new UserFileSystem(this.userId);
            await fileSystem.deleteFileAndThumbnail(
                collectionId,
                collectionFile.filename
            );

            transaction.commit();
            return {};
        } catch (error) {
            transaction.rollback();
            throw error;
        }
    }

    async getCollectionFiles(
        collectionId: string
    ): Promise<GetCollectionFilesResult> {
        if (!collectionId || !isUuidv4(collectionId)) {
            return {
                notFound: true
            };
        }
        const db = await Database.getInstance();
        const collection = await db.models.Collection.findOne({
            where: {
                UserId: this.userId,
                id: collectionId
            },
            include: [db.models.CollectionFile, db.models.Tag]
        });
        if (!collection) {
            return {
                notFound: true
            };
        }
        const files =
            collection.CollectionFiles?.map((file) => ({
                id: file.id,
                collectionId: file.CollectionId,
                name: file.label,
                mimeType: file.mimeType,
                src: this.getSrc(file.CollectionId, file.id, file.mimeType),
                thumbnailSrc: this.getSrc(
                    file.CollectionId,
                    file.id,
                    file.mimeType,
                    true
                ),
                width: file.width,
                height: file.height,
                thumbnailWidth: file.thumbnailWidth,
                thumbnailHeight: file.thumbnailHeight,
                createdAt: file.createdAt.getTime(),
                updatedAt: file.updatedAt.getTime()
            })) || [];
        return {
            collection: {
                id: collection.id,
                name: collection.name,
                createdAt: collection.createdAt.getTime(),
                updatedAt: collection.updatedAt.getTime(),
                tags: collection.Tags?.map((tag) => tag.name) || [],
                thumbnails: files.slice(0, 4).map((file) => file.thumbnailSrc)
            },
            files
        };
    }

    async getVideoStream(
        collectionId: string,
        videoId: string,
        chunkStart: number
    ): Promise<GetStreamResult> {
        if (!isUuidv4(collectionId) || !isUuidv4(videoId)) {
            return {
                notFound: true
            };
        }

        const fileInfo = await this.getCollectionFileInfo(
            collectionId,
            videoId
        );
        if (!fileInfo) {
            return {
                notFound: true
            };
        }

        const fileSystem = new UserFileSystem(this.userId);
        const { stream, totalLengthBytes, chunkStartEnd } =
            await fileSystem.getFileStream(
                collectionId,
                fileInfo.filename,
                chunkStart,
                CHUNK_SIZE_BYTES
            );
        if (!stream) {
            return {
                notFound: true
            };
        }

        return {
            stream,
            filename: fileInfo.label,
            mimeType: fileInfo.mimeType,
            chunkStartEnd,
            totalLengthBytes
        };
    }

    async getFileThumbnail(
        collectionId: string,
        fileId: string
    ): Promise<GetFileResult> {
        return this.getFile(collectionId, fileId, true);
    }

    async getFile(
        collectionId: string,
        fileId: string,
        thumbnail: boolean = false
    ): Promise<GetFileResult> {
        if (
            !collectionId ||
            !isUuidv4(collectionId) ||
            !fileId ||
            !isUuidv4(fileId)
        ) {
            return { notFound: true };
        }

        const fileInfo = await this.getCollectionFileInfo(collectionId, fileId);
        if (!fileInfo) {
            return {
                notFound: true
            };
        }

        const fileSystem = new UserFileSystem(this.userId);
        const file = await fileSystem.readFile(
            collectionId,
            fileInfo.filename,
            thumbnail
        );
        if (!file) {
            return {
                notFound: true
            };
        }
        return {
            mimeType: fileInfo.mimeType,
            file,
            filename: fileInfo.label
        };
    }

    async uploadCollection(
        collectionName: string,
        req: IncomingMessage
    ): Promise<CreateResult> {
        const { collection, error } = await this.create(collectionName, []);
        if (!collection || error) {
            return { error };
        }
        try {
            const { files, error } = await this.uploadFiles(collection.id, req);
            if (!files || error) {
                throw error;
            }
            collection.thumbnails = files
                .map((file) => file.thumbnailSrc)
                .slice(0, 4);
            return {
                collection
            };
        } catch (error) {
            await this.delete(collection.id);
            throw error;
        }
    }

    async uploadFiles(
        collectionId: string,
        req: IncomingMessage
    ): Promise<UploadResult> {
        if (!collectionId || !isUuidv4(collectionId)) {
            return { error: `Invalid collection id '${collectionId}'` };
        }

        const db = await Database.getInstance();
        const transaction = await db.transaction();
        const fileSystem = new UserFileSystem(this.userId);
        try {
            const files = await fileSystem.uploadFilesToTempDir(req);
            const insertedRows = await db.models.CollectionFile.bulkCreate(
                files.map((file) => ({
                    label: file.originalFilename,
                    mimeType: file.mimeType,
                    filename: file.filename,
                    width: file.width,
                    height: file.height,
                    thumbnailWidth: file.thumbnailWidth,
                    thumbnailHeight: file.thumbnailHeight,
                    CollectionId: collectionId
                })),
                {
                    transaction
                }
            );
            await fileSystem.mergeTempDirToCollectionDir(collectionId);
            await transaction.commit();
            return {
                files: insertedRows.map((row) => ({
                    id: row.id,
                    collectionId: row.CollectionId,
                    name: row.label,
                    mimeType: row.mimeType,
                    src: this.getSrc(row.CollectionId, row.id, row.mimeType),
                    thumbnailSrc: this.getSrc(
                        row.CollectionId,
                        row.id,
                        row.mimeType,
                        true
                    ),
                    width: row.width,
                    height: row.height,
                    thumbnailWidth: row.thumbnailWidth,
                    thumbnailHeight: row.thumbnailHeight,
                    createdAt: row.createdAt.getTime(),
                    updatedAt: row.updatedAt.getTime()
                }))
            };
        } catch (error) {
            transaction.rollback();
            throw error;
        } finally {
            await fileSystem.clearTempDir();
        }
    }

    async update(collection: CollectionDto): Promise<UpdateResult> {
        if (!collection.id) {
            return { notFound: true };
        }
        if (!collection.name) {
            return { error: "Invalid collection name" };
        }
        if (await this.nameTaken(collection.name, collection.id)) {
            return { error: "Collection name already exists" };
        }
        return Database.withTransaction(async (transaction, db) => {
            const collectionInDb = await db.models.Collection.findOne({
                where: {
                    UserId: this.userId,
                    id: collection.id
                },
                include: {
                    model: db.models.CollectionFile,
                    limit: 4
                }
            });
            if (!collectionInDb) {
                return { notFound: true };
            }
            // update collection
            collectionInDb.name = collection.name;
            await collectionInDb.save({ transaction });

            // create new tags
            await db.models.Tag.bulkCreate(
                collection.tags.map((tag) => ({ name: tag })),
                {
                    ignoreDuplicates: true,
                    returning: false,
                    transaction
                }
            );
            // update junction table
            await db.models.CollectionTag.destroy({
                where: {
                    CollectionId: collectionInDb.id,
                    TagName: {
                        [Op.notIn]: collection.tags
                    }
                }
            });
            await db.models.CollectionTag.bulkCreate(
                collection.tags.map((tag) => ({
                    TagName: tag,
                    CollectionId: collectionInDb.id
                })),
                {
                    ignoreDuplicates: true,
                    returning: false,
                    transaction
                }
            );
            // fetch tags from junction table
            const collectionTags = await db.models.CollectionTag.findAll({
                where: {
                    CollectionId: collectionInDb.id
                }
            });
            return {
                collection: {
                    id: collectionInDb.id,
                    name: collectionInDb.name,
                    createdAt: collectionInDb.createdAt.getTime(),
                    updatedAt: collectionInDb.updatedAt.getTime(),
                    tags: collectionTags.map((tag) => tag.TagName),
                    thumbnails:
                        collectionInDb.CollectionFiles?.map((file) =>
                            this.getSrc(
                                collectionInDb.id,
                                file.id,
                                file.mimeType,
                                true
                            )
                        ) || []
                }
            };
        }).catch((error) => {
            throw new Error(
                `Error updating collection '${collection.name}'`,
                error
            );
        });
    }

    async delete(collectionId: string): Promise<DeleteResult> {
        if (!isUuidv4(collectionId)) {
            return { error: `Invalid collection id '${collectionId}'` };
        }

        return Database.withTransaction(async (transaction, db) => {
            await db.models.Collection.destroy({
                where: {
                    UserId: this.userId,
                    id: collectionId
                },
                transaction
            });
            const fileSystem = new UserFileSystem(this.userId);
            await fileSystem.deleteCollectionDir(collectionId);
            return {};
        }).catch((error) => {
            throw new Error(`Error deleting collection '${collectionId}'`, {
                cause: error
            });
        });
    }

    async create(name: string, tags: string[]): Promise<CreateResult> {
        if (!name) {
            return { error: "Invalid collection name" };
        }
        if (!Array.isArray(tags)) {
            return { error: "Invalid collection tags" };
        }
        if (await this.nameTaken(name)) {
            return { error: "Collection name already exists" };
        }
        return Database.withTransaction(async (transaction, db) => {
            const collection = await db.models.Collection.create(
                {
                    name,
                    UserId: this.userId
                },
                { transaction }
            );
            await db.models.Tag.bulkCreate(
                tags.map((tag) => ({ name: tag })),
                {
                    ignoreDuplicates: true,
                    returning: false,
                    transaction
                }
            );
            const collectionTags = await db.models.CollectionTag.bulkCreate(
                tags.map((tag) => ({
                    TagName: tag,
                    CollectionId: collection.id
                })),
                { transaction }
            );

            return {
                collection: {
                    id: collection.id,
                    name: collection.name,
                    createdAt: collection.createdAt.getTime(),
                    updatedAt: collection.updatedAt.getTime(),
                    tags: collectionTags.map((tag) => tag.TagName),
                    thumbnails: []
                }
            };
        });
    }

    async getAll(): Promise<CollectionDto[]> {
        try {
            const db = await Database.getInstance();
            const result = await db.models.Collection.findAll({
                where: {
                    UserId: this.userId
                },
                include: [
                    {
                        model: db.models.Tag
                    },
                    {
                        model: db.models.CollectionFile,
                        limit: 4
                    }
                ]
            });
            return result.map((collection) => ({
                id: collection.id,
                name: collection.name,
                tags: collection.Tags?.map((tag) => tag.name) || [],
                thumbnails:
                    collection.CollectionFiles?.map((file) =>
                        this.getSrc(collection.id, file.id, file.mimeType, true)
                    ) || [],
                createdAt: collection.createdAt.getTime(),
                updatedAt: collection.updatedAt.getTime()
            }));
        } catch (error) {
            throw new Error(
                `Error fetching collections for user '${this.userId}'`,
                { cause: error }
            );
        }
    }

    private async getCollectionFileInfo(collectionId: string, fileId: string) {
        const db = await Database.getInstance();
        const collectionFile = await db.models.CollectionFile.findOne({
            where: {
                CollectionId: collectionId,
                id: fileId
            },
            attributes: ["mimeType", "filename", "label"],
            include: {
                model: db.models.Collection,
                required: true,
                where: {
                    UserId: this.userId
                }
            }
        });
        if (!collectionFile) {
            return null;
        }
        return {
            filename: collectionFile.filename,
            label: collectionFile.label,
            mimeType: collectionFile.mimeType
        };
    }

    private async nameTaken(name: string, collectionId?: string) {
        const db = await Database.getInstance();
        const existing = await db.models.Collection.findAll({
            where: {
                UserId: this.userId,
                id: {
                    [Op.ne]: collectionId || EMPTY_UUIDV4
                },
                name: name.trim()
            }
        });
        return existing.length > 0;
    }

    private getSrc(
        collectionId: string,
        fileId: string,
        mimeType: string,
        thumbnail: boolean = false
    ) {
        const isImage = mimeType.includes("image");
        return `/api/collections/${collectionId}/files?${
            thumbnail ? "thumbnail" : isImage ? "image" : "video"
        }=${fileId}`;
    }
}

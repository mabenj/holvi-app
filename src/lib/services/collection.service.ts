import Database from "@/db/Database";
import { NextApiRequest } from "next";
import { Op } from "sequelize";
import { UserFileSystem } from "../common/user-file-system";
import { EMPTY_UUIDV4, isUuidv4 } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";

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

export class CollectionService {
    constructor(private readonly userId: string) {}

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
        return {
            collection: {
                id: collection.id,
                name: collection.name,
                createdAt: collection.createdAt.getTime(),
                updatedAt: collection.updatedAt.getTime(),
                tags: collection.Tags?.map((tag) => tag.name) || []
            },
            files:
                collection.CollectionFiles?.map((file) => ({
                    id: file.id,
                    collectionId: file.CollectionId,
                    name: file.label,
                    mimeType: file.mimeType,
                    src: `/api/collections/${file.CollectionId}/files?${
                        file.mimeType.includes("image") ? "image" : "video"
                    }=${file.id}`,
                    thumbnailSrc: `/api/collections/${file.CollectionId}/files?thumbnail=${file.id}`,
                    width: file.width,
                    height: file.height,
                    thumbnailWidth: file.thumbnailWidth,
                    thumbnailHeight: file.thumbnailHeight,
                    createdAt: file.createdAt.getTime(),
                    updatedAt: file.updatedAt.getTime()
                })) || []
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
            return {
                notFound: true
            };
        }

        const fileSystem = new UserFileSystem(this.userId);
        const file = await fileSystem.readFile(
            collectionId,
            collectionFile.filename,
            thumbnail
        );
        if (!file) {
            return {
                notFound: true
            };
        }
        return {
            mimeType: collectionFile.mimeType,
            file,
            filename: collectionFile.label
        };
    }

    async uploadFiles(
        collectionId: string,
        req: NextApiRequest
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
                files: insertedRows.map((row) => {
                    const isImage = row.mimeType.includes("image");
                    return {
                        id: row.id,
                        collectionId: row.CollectionId,
                        name: row.label,
                        mimeType: row.mimeType,
                        src: `/api/collections/${row.CollectionId}/files?${
                            isImage ? "image" : "video"
                        }=${row.id}`,
                        thumbnailSrc: `/api/collections/${row.CollectionId}/files?thumbnail=${row.id}`,
                        width: row.width,
                        height: row.height,
                        thumbnailWidth: row.thumbnailWidth,
                        thumbnailHeight: row.thumbnailHeight,
                        createdAt: row.createdAt.getTime(),
                        updatedAt: row.updatedAt.getTime()
                    };
                })
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
                }
            });
            if (!collectionInDb) {
                return { notFound: true };
            }
            collectionInDb.name = collection.name;
            await collectionInDb.save({ transaction });

            await db.models.Tag.destroy({
                where: {
                    CollectionId: collectionInDb.id
                }
            });
            const insertedTags = await db.models.Tag.bulkCreate(
                collection.tags.map((tag) => ({
                    name: tag,
                    CollectionId: collection.id
                })),
                { transaction }
            );
            return {
                collection: {
                    id: collectionInDb.id,
                    name: collectionInDb.name,
                    createdAt: collectionInDb.createdAt.getTime(),
                    updatedAt: collectionInDb.updatedAt.getTime(),
                    tags: insertedTags.map((tag) => tag.name)
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

    async create(name: string, tags: string): Promise<CreateResult> {
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
            const insertedTags = await db.models.Tag.bulkCreate(
                tags.map((tag) => ({
                    name: tag,
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
                    tags: insertedTags.map((tag) => tag.name)
                }
            };
        }).catch((error) => {
            throw new Error("Error creating collection", { cause: error });
        });
    }

    async get(collectionId: string): Promise<GetResult> {
        if (!isUuidv4(collectionId)) {
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
            include: db.models.Tag
        });
        if (!collection) {
            return { notFound: true };
        }
        return {
            collection: {
                id: collection.id,
                name: collection.name,
                tags: collection.Tags?.map((tag) => tag.name) || [],
                createdAt: collection.createdAt.getTime(),
                updatedAt: collection.updatedAt.getTime()
            }
        };
    }

    async getAll(): Promise<CollectionDto[]> {
        try {
            const db = await Database.getInstance();
            const result = await db.models.Collection.findAll({
                where: {
                    UserId: this.userId
                },
                include: db.models.Tag
            });
            return result.map((collection) => ({
                id: collection.id,
                name: collection.name,
                tags: collection.Tags?.map((tag) => tag.name) || [],
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
}

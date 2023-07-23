import Database from "@/db/Database";
import { ReadStream } from "fs";
import { IncomingMessage } from "http";
import { Op } from "sequelize";
import appConfig from "../common/app-config";
import { HolviError, NotFoundError } from "../common/errors";
import { UserFileSystem } from "../common/user-file-system";
import { EMPTY_UUIDV4 } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { UpdateCollectionFileData } from "../validators/update-collection-file-validator";
import { UpdateCollectionData } from "../validators/update-collection-validator";

interface CreateResult {
    collection?: CollectionDto;
    nameError?: string;
    errors?: string[]
}

interface GetBufferResult {
    file: Buffer;
    filename: string;
    mimeType: string;
}

interface GetStreamResult {
    stream: ReadStream;
    chunkStartEnd: [start: number, end: number];
    totalLengthBytes: number;
    mimeType: string;
    filename: string;
}

export class CollectionService {
    constructor(private readonly userId: string) {}

    async getAllFiles(): Promise<CollectionFileDto[]> {
        const db = await Database.getInstance();
        const files = await db.models.CollectionFile.findAll({
            include: {
                model: db.models.Collection,
                required: true,
                where: {
                    UserId: this.userId
                }
            }
        });
        return files.map((file) => file.toDto());
    }

    async updateFile(
        collectionId: string,
        data: UpdateCollectionFileData
    ): Promise<CollectionFileDto> {
        const db = await Database.getInstance();
        await this.throwIfNotUserCollection(collectionId);
        const fileInDb = await db.models.CollectionFile.findByPk(data.id);
        if (!fileInDb) {
            throw new NotFoundError(`File '${data.id}' not found`);
        }

        const transaction = await db.transaction();
        try {
            // update file
            fileInDb.label = data.name;
            await fileInDb.save({ transaction });

            // create new tags
            await db.models.Tag.bulkCreate(
                data.tags.map((tag) => ({ name: tag })),
                {
                    ignoreDuplicates: true,
                    returning: false,
                    transaction
                }
            );

            // update junction table
            await db.models.CollectionFileTag.destroy({
                where: {
                    CollectionFileId: fileInDb.id,
                    TagName: {
                        [Op.notIn]: data.tags
                    }
                },
                transaction
            });
            await db.models.CollectionFileTag.bulkCreate(
                data.tags.map((tag) => ({
                    TagName: tag,
                    CollectionFileId: fileInDb.id
                })),
                {
                    ignoreDuplicates: true,
                    returning: false,
                    transaction
                }
            );

            await transaction.commit();

            // fetch tags from junction table
            const fileTags = await db.models.CollectionFileTag.findAll({
                where: {
                    CollectionFileId: fileInDb.id
                }
            });

            return fileInDb.toDto();
        } catch (error) {
            transaction.rollback();
            throw new HolviError(`Error updating file '${data.id}'`, error);
        }
    }

    async getCollection(collectionId: string): Promise<CollectionDto> {
        const db = await Database.getInstance();
        await this.throwIfNotUserCollection(collectionId);
        const collection = await db.models.Collection.findByPk(collectionId, {
            include: db.models.Tag
        });
        if (!collection) {
            throw new NotFoundError(`Collection '${collectionId}' not found`);
        }
        return collection.toDto();
    }

    async deleteFile(collectionId: string, fileId: string) {
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        await this.throwIfNotUserCollection(collectionId);

        try {
            const collectionFile = await db.models.CollectionFile.findByPk(
                fileId
            );
            if (!collectionFile) {
                throw new NotFoundError(`File not found '${fileId}'`);
            }
            collectionFile.destroy({ transaction });

            const fileSystem = new UserFileSystem(this.userId);
            await fileSystem.deleteFileAndThumbnail(
                collectionId,
                collectionFile.id
            );

            await transaction.commit();
        } catch (error) {
            transaction.rollback();
            throw new HolviError(`Error deleting file '${fileId}'`, error);
        }
    }

    async getFiles(collectionId: string): Promise<CollectionFileDto[]> {
        const db = await Database.getInstance();
        await this.throwIfNotUserCollection(collectionId);
        const collectionFiles = await db.models.CollectionFile.findAll({
            where: {
                CollectionId: collectionId
            },
            include: db.models.Tag
        });
        return collectionFiles?.map((file) => file.toDto()) || [];
    }

    async getVideoStream(
        collectionId: string,
        videoId: string,
        chunkStart: number
    ): Promise<GetStreamResult> {
        const fileInfo = await this.getCollectionFileInfo(
            collectionId,
            videoId
        );
        if (!fileInfo) {
            throw new NotFoundError(`File not found '${videoId}'`);
        }

        const fileSystem = new UserFileSystem(this.userId);
        const { stream, totalLengthBytes, chunkStartEnd } =
            await fileSystem.getFileStream(
                collectionId,
                fileInfo.id,
                chunkStart,
                appConfig.streamChunkSize
            );
        if (!stream) {
            throw new HolviError(
                `Could not get file stream for file '${videoId}'`
            );
        }

        return {
            stream,
            filename: fileInfo.label,
            mimeType: fileInfo.mimeType,
            chunkStartEnd,
            totalLengthBytes
        };
    }

    async getFileThumbnailBuffer(
        collectionId: string,
        fileId: string
    ): Promise<GetBufferResult> {
        return this.getFileBuffer(collectionId, fileId, true);
    }

    async getFileBuffer(
        collectionId: string,
        fileId: string,
        thumbnail: boolean = false
    ): Promise<GetBufferResult> {
        const fileInfo = await this.getCollectionFileInfo(collectionId, fileId);
        if (!fileInfo) {
            throw new NotFoundError(`File not found '${fileId}'`);
        }

        const fileSystem = new UserFileSystem(this.userId);
        const file = await fileSystem.readFile(
            collectionId,
            fileInfo.id,
            thumbnail
        );
        if (!file) {
            throw new HolviError(`Could not read file '${fileId}'`);
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
        const { collection, nameError } = await this.createCollection(
            collectionName,
            []
        );
        if (!collection || nameError) {
            return { nameError };
        }
        try {
            const { files, errors } = await this.uploadFiles(
                collection.id,
                req
            );
            collection.thumbnails = files
                .map((file) => file.thumbnailSrc)
                .slice(0, 4);
            return {
                collection,
                errors
            };
        } catch (error) {
            await this.deleteCollection(collection.id);
            throw new HolviError("Error uploading collection", error);
        }
    }

    async uploadFiles(
        collectionId: string,
        req: IncomingMessage
    ): Promise<{ files: CollectionFileDto[]; errors: string[] }> {
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        await this.throwIfNotUserCollection(collectionId);
        const fileSystem = new UserFileSystem(this.userId);
        try {
            const { files, errors } = await fileSystem.uploadFilesToTempDir(
                req
            );
            const insertedRows = await db.models.CollectionFile.bulkCreate(
                files.map((file) => ({
                    id: file.id,
                    label: file.originalFilename,
                    mimeType: file.mimeType,
                    width: file.width,
                    height: file.height,
                    thumbnailWidth: file.thumbnailWidth,
                    thumbnailHeight: file.thumbnailHeight,
                    CollectionId: collectionId,
                    gpsLatitude: file.gps?.latitude,
                    gpsLongitude: file.gps?.longitude,
                    gpsAltitude: file.gps?.altitude,
                    gpsLabel: file.gps?.label,
                    takenAt: file.takenAt
                })),
                {
                    transaction
                }
            );
            await fileSystem.mergeTempDirToCollectionDir(collectionId);
            await transaction.commit();
            return {
                files: insertedRows.map((row) => row.toDto()),
                errors: errors
            };
        } catch (error) {
            transaction.rollback();
            throw new HolviError(
                `Error uploading files to collection '${collectionId}'`,
                error
            );
        } finally {
            await fileSystem.clearTempDir();
        }
    }

    async updateCollection(
        collection: UpdateCollectionData
    ): Promise<CreateResult> {
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        await this.throwIfNotUserCollection(collection.id);

        if (await this.nameTaken(collection.name, collection.id)) {
            return { nameError: "Collection name already exists" };
        }

        try {
            const collectionInDb = await db.models.Collection.findByPk(
                collection.id,
                {
                    include: db.models.CollectionFile
                }
            );
            if (!collectionInDb) {
                throw new NotFoundError(
                    `Collection not found '${collection.id}'`
                );
            }
            // update file
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

            await transaction.commit();

            // fetch tags from junction table
            const collectionTags = await db.models.CollectionTag.findAll({
                where: {
                    CollectionId: collectionInDb.id
                }
            });

            return {
                collection: {
                    ...collectionInDb.toDto(),
                    tags: collectionTags.map((tag) => tag.TagName)
                }
            };
        } catch (error) {
            transaction.rollback();
            throw new HolviError(
                `Error updating collection '${collection.name}'`,
                error
            );
        }
    }

    async deleteCollection(collectionId: string) {
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        await this.throwIfNotUserCollection(collectionId);

        try {
            await db.models.Collection.destroy({
                where: {
                    id: collectionId
                },
                transaction
            });
            const fileSystem = new UserFileSystem(this.userId);
            await fileSystem.deleteCollectionDir(collectionId);
            await transaction.commit();
        } catch (error) {
            transaction.rollback();
            throw new HolviError(
                `Error deleting collection '${collectionId}'`,
                error
            );
        }
    }

    async createCollection(
        name: string,
        tags: string[]
    ): Promise<CreateResult> {
        if (await this.nameTaken(name)) {
            return { nameError: "Collection name already exists" };
        }
        const db = await Database.getInstance();
        const transaction = await db.transaction();
        try {
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

            await transaction.commit();
            return {
                collection: {
                    ...collection.toDto(),
                    tags: collectionTags.map((tag) => tag.TagName)
                }
            };
        } catch (error) {
            transaction.rollback();
            throw new HolviError("Error creating collection", error);
        }
    }

    async getAllCollections(): Promise<CollectionDto[]> {
        const db = await Database.getInstance();
        const collections = await db.models.Collection.findAll({
            where: {
                UserId: this.userId
            },
            include: [db.models.Tag, db.models.CollectionFile]
        });
        return collections.map((collection) => collection.toDto());
    }

    private async getCollectionFileInfo(collectionId: string, fileId: string) {
        const db = await Database.getInstance();
        const collectionFile = await db.models.CollectionFile.findOne({
            where: {
                CollectionId: collectionId,
                id: fileId
            },
            attributes: ["mimeType", "id", "label"],
            include: {
                model: db.models.Collection,
                required: true,
                where: {
                    UserId: this.userId
                }
            },
            raw: true
        });
        if (!collectionFile) {
            return null;
        }
        return {
            id: collectionFile.id,
            label: collectionFile.label,
            mimeType: collectionFile.mimeType
        };
    }

    private async throwIfNotUserCollection(collectionId: string) {
        const db = await Database.getInstance();
        const collection = await db.models.Collection.findByPk(collectionId, {
            attributes: ["UserId"],
            raw: true
        });
        if (!collection || collection.UserId !== this.userId) {
            throw new NotFoundError(`Collection not found '${collectionId}'`);
        }
    }

    private async nameTaken(name: string, collectionId?: string) {
        const db = await Database.getInstance();
        const existing = await db.models.Collection.findOne({
            where: {
                UserId: this.userId,
                id: {
                    [Op.ne]: collectionId || EMPTY_UUIDV4
                },
                name: name.trim()
            },
            raw: true
        });
        return !!existing;
    }
}

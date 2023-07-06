import Database from "@/db/Database";
import { NextApiRequest } from "next";
import path from "path";
import { Op } from "sequelize";
import {
    deleteDirectory,
    getImageDimensions,
    moveDirectoryContents,
    readBytes
} from "../common/file-system-helpers";
import Log from "../common/log";
import parseForm from "../common/parse-form";
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
    mimeType?: string;
    notFound?: boolean;
}

interface GetCollectionFilesResult {
    notFound?: boolean;
    collection?: CollectionDto;
    files?: CollectionFileDto[];
}

export class CollectionService {
    constructor(private readonly userId: string) {}

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
                    name: file.name,
                    mimeType: file.mimeType,
                    src: `/api/collections/${file.CollectionId}/files/${file.id}`,
                    width: file.width,
                    height: file.height,
                    thumbnailSrc: `/api/collections/${file.CollectionId}/files/${file.id}`,
                    thumbnailWidth: file.thumbnailWidth,
                    thumbnailHeight: file.thumbnailHeight,
                    createdAt: file.createdAt.getTime(),
                    updatedAt: file.updatedAt.getTime()
                })) || []
        };
    }

    async getFile(
        collectionId: string,
        fileId: string
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
            attributes: ["mimeType", "path"],
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

        const file = await readBytes(
            path.join(this.getDataDir(), collectionFile.path)
        );
        if (!file) {
            return {
                notFound: true
            };
        }
        return { mimeType: collectionFile.mimeType, file };
    }

    async uploadFiles(
        collectionId: string,
        req: NextApiRequest
    ): Promise<UploadResult> {
        if (!collectionId || !isUuidv4(collectionId)) {
            return { error: `Invalid collection id '${collectionId}'` };
        }
        if (!process.env.DATA_DIR) {
            throw new Error(
                "Data directory not defined, use environment variable 'DATA_DIR'"
            );
        }

        const workingDir = path.join(
            this.getUserCollectionDir(collectionId),
            "upload"
        );
        try {
            // move files to working directory
            const { fields, files } = await parseForm(
                req,
                workingDir,
                (percent) => Log.info(`Upload progress ${percent}%`)
            );
            const fileList = Object.keys(files).flatMap((file) => files[file]);
            const timestamp = new Date().toISOString();
            const fileRows = fileList.map((file, i) => {
                const fallbackName = `${timestamp}_${i}`;
                const tempPath = path.join(
                    workingDir,
                    file.newFilename || fallbackName
                );
                const finalPath = path.join(
                    this.userId.toString(),
                    collectionId,
                    file.newFilename || fallbackName
                );
                const isImage = file.mimetype?.includes("image") || false;
                const { width, height } = isImage
                    ? getImageDimensions(tempPath)
                    : { width: -1, height: -1 };
                return {
                    name: file.originalFilename || fallbackName,
                    mimeType: file.mimetype || "unknown",
                    path: finalPath,
                    width: width || -1,
                    height: height || -1,
                    thumbnailWidth: width || -1,
                    thumbnailHeight: height || -1,
                    CollectionId: collectionId
                };
            });

            // insert info into db
            const insertedRows = await Database.withTransaction(
                async (transaction, db) =>
                    db.models.CollectionFile.bulkCreate(fileRows, {
                        transaction
                    })
            );

            // move files from working directory to user directory
            await moveDirectoryContents(
                workingDir,
                this.getUserCollectionDir(collectionId)
            );

            return {
                files: insertedRows.map((row) => ({
                    id: row.id,
                    collectionId: row.CollectionId,
                    name: row.name,
                    mimeType: row.mimeType,
                    src: `/api/collections/${row.CollectionId}/files/${row.id}`,
                    thumbnailSrc: `/api/collections/${row.CollectionId}/files/${row.id}`,
                    width: row.width,
                    height: row.height,
                    thumbnailWidth: row.thumbnailWidth,
                    thumbnailHeight: row.thumbnailHeight,
                    createdAt: row.createdAt.getTime(),
                    updatedAt: row.updatedAt.getTime()
                }))
            };
        } catch (error) {
            throw new Error("Error uploading file(s)", { cause: error });
        } finally {
            await deleteDirectory(workingDir);
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
        const collectionDir = this.getUserCollectionDir(collectionId);

        return Database.withTransaction(async (transaction, db) => {
            await db.models.Collection.destroy({
                where: {
                    UserId: this.userId,
                    id: collectionId
                },
                transaction
            });
            await deleteDirectory(collectionDir);
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

    private getUserCollectionDir(collectionId: string) {
        return path.join(
            this.getDataDir(),
            this.userId.toString(),
            collectionId
        );
    }

    private getDataDir() {
        if (!process.env.DATA_DIR) {
            throw new Error(
                "Data directory not defined, use environment variable 'DATA_DIR'"
            );
        }
        return process.env.DATA_DIR;
    }
}

import Database from "@/db/Database";
import { Op } from "sequelize";
import { getFileSrc } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { SearchResult } from "../interfaces/search-result";

export default class SearchService {
    constructor(private readonly userId: string) {}

    async search(query: string): Promise<SearchResult> {
        query = query.trim();
        if (!query) {
            return {
                collections: [],
                files: []
            };
        }
        const [collectionIds, fileIds] = await Promise.all([
            this.getMatchingCollectionIds(query),
            this.getMatchingFileIds(query)
        ]);
        const [collections, files] = await Promise.all([
            this.getCollectionDtos(collectionIds),
            this.getFileDtos(fileIds)
        ]);
        return { collections, files };
    }

    private async getCollectionDtos(
        collectionIds: string[]
    ): Promise<CollectionDto[]> {
        const db = await Database.getInstance();
        const collections = await db.models.Collection.findAll({
            where: {
                id: {
                    [Op.in]: collectionIds
                }
            },
            include: [
                db.models.Tag,
                { model: db.models.CollectionFile, limit: 4 }
            ]
        });
        return collections.map((collection) => ({
            id: collection.id,
            name: collection.name,
            tags: collection.Tags?.map((tag) => tag.name) || [],
            thumbnails:
                collection.CollectionFiles?.map((file) =>
                    getFileSrc({
                        collectionId: collection.id,
                        fileId: file.id,
                        mimeType: file.mimeType,
                        thumbnail: true
                    })
                ) || [],
            createdAt: collection.createdAt.getTime(),
            updatedAt: collection.updatedAt.getTime()
        }));
    }

    private async getFileDtos(fileIds: string[]): Promise<CollectionFileDto[]> {
        const db = await Database.getInstance();
        const files = await db.models.CollectionFile.findAll({
            where: {
                id: {
                    [Op.in]: fileIds
                }
            },
            include: db.models.Tag
        });
        return files.map((file) => ({
            id: file.id,
            name: file.label,
            collectionId: file.CollectionId,
            mimeType: file.mimeType,
            tags: file.Tags?.map((tag) => tag.name) || [],
            src: getFileSrc({
                collectionId: file.CollectionId,
                fileId: file.id,
                mimeType: file.mimeType
            }),
            thumbnailSrc: getFileSrc({
                collectionId: file.CollectionId,
                fileId: file.id,
                mimeType: file.mimeType,
                thumbnail: true
            }),
            width: file.width,
            height: file.height,
            thumbnailWidth: file.thumbnailWidth,
            thumbnailHeight: file.thumbnailHeight,
            createdAt: file.createdAt.getTime(),
            updatedAt: file.updatedAt.getTime()
        }));
    }

    private async getMatchingCollectionIds(query: string): Promise<string[]> {
        const db = await Database.getInstance();
        return db
            .select(
                `SELECT c.id 
            FROM "Collections" c
            LEFT JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
            WHERE c."UserId"::text = :userId AND 
                (c.name LIKE :likeQuery OR ct."TagName" = :eqQuery)`,
                {
                    userId: this.userId,
                    likeQuery: `%${query}%`,
                    eqQuery: query
                }
            )
            .then((rows) => rows.map((row: any) => row.id));
    }

    private async getMatchingFileIds(query: string): Promise<string[]> {
        const db = await Database.getInstance();

        return db
            .select(
                `SELECT cf.id
            FROM "CollectionFiles" cf
            JOIN "Collections" c ON c.id = cf."CollectionId"
            LEFT JOIN "CollectionFileTags" cft ON cft."CollectionFileId" = cf.id
            WHERE c."UserId"::text = :userId AND 
                (cf.label LIKE :likeQuery OR cft."TagName" = :eqQuery)`,
                {
                    userId: this.userId,
                    likeQuery: `%${query}%`,
                    eqQuery: query
                }
            )
            .then((rows) => rows.map((row: any) => row.id));
    }
}

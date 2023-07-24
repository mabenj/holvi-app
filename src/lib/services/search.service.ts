import Database from "@/db/Database";
import { Op } from "sequelize";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { SearchResult } from "../types/search-result";

export default class SearchService {
    constructor(private readonly userId: string) {}

    async tagAutocomplete(query: string): Promise<string[]> {
        query = query.trim();
        if (!query) {
            return [];
        }
        const [collectionTags, fileTags] = await Promise.all([
            this.getMatchingCollectionTags(query),
            this.getMatchingFileTags(query)
        ]);
        return [...collectionTags, ...fileTags].sort((a, b) =>
            a.localeCompare(b)
        );
    }

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
            include: [db.models.Tag, db.models.CollectionFile]
        });
        return collections.map((collection) => collection.toDto());
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
        return files.map((file) => file.toDto());
    }

    private async getMatchingCollectionTags(query: string): Promise<string[]> {
        const sql = `SELECT DISTINCT ct."TagName" as tag 
                    FROM "Collections" c
                    JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId AND ct."TagName" LIKE :likeQuery`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`
        };
        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.tag));
    }

    private async getMatchingFileTags(query: string): Promise<string[]> {
        const sql = `SELECT DISTINCT cft."TagName" as tag
                    FROM "CollectionFiles" cf
                    JOIN "Collections" c ON c.id = cf."CollectionId"
                    JOIN "CollectionFileTags" cft ON cft."CollectionFileId" = cf.id
                    WHERE c."UserId"::text = :userId AND cft."TagName" LIKE :likeQuery`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`
        };
        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.tag));
    }

    private async getMatchingCollectionIds(query: string): Promise<string[]> {
        const sql = `SELECT DISTINCT c.id 
                    FROM "Collections" c
                    LEFT JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId AND 
                        (c.name LIKE :likeQuery OR ct."TagName" = :eqQuery)`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`,
            eqQuery: query
        };
        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.id));
    }

    private async getMatchingFileIds(query: string): Promise<string[]> {
        const sql = `SELECT DISTINCT cf.id
                    FROM "CollectionFiles" cf
                    JOIN "Collections" c ON c.id = cf."CollectionId"
                    LEFT JOIN "CollectionFileTags" cft ON cft."CollectionFileId" = cf.id
                    LEFT JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId AND 
                        (cf.name LIKE :likeQuery OR cft."TagName" = :eqQuery OR ct."TagName" = :eqQuery)`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`,
            eqQuery: query
        };
        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.id));
    }
}

import Database from "@/db/Database";
import { Op, QueryTypes } from "sequelize";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { SearchResult } from "../types/search-result";
import { SearchRequest } from "../validators/search-request.validator";

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

    async search(searchRequest: SearchRequest): Promise<SearchResult> {
        const [collectionIds, fileIds] = await Promise.all([
            this.getMatchingCollectionIds(searchRequest),
            this.getMatchingFileIds(searchRequest)
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

    private getMatchingCollectionTags(query: string): Promise<string[]> {
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

    private getMatchingFileTags(query: string): Promise<string[]> {
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

    private getMatchingCollectionIds(
        searchRequest: SearchRequest
    ): Promise<string[]> {
        const { query, tags, collectionId, sort } = searchRequest;
        const sql = `SELECT DISTINCT c.id, c.name, c."createdAt"
                    FROM "Collections" c
                    LEFT JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId AND c.id::text LIKE :likeCollectionId AND
                        c.name LIKE :likeQuery ${
                            tags.length ? 'AND ct."TagName" IN(:tags)' : ""
                        }
                    ORDER BY ${
                        sort.field === "name" ? "c.name" : 'c."createdAt"'
                    } ${sort.asc ? "ASC" : "DESC"}`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`,
            likeCollectionId: collectionId ? collectionId : "%",
            tags: tags
        };
        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.id));
    }

    private async getMatchingFileIds(
        searchRequest: SearchRequest
    ): Promise<string[]> {
        console.log(searchRequest);
        const { query, tags, collectionId, sort } = searchRequest;
        const sql = `SELECT cf.*
                    FROM "CollectionFiles" cf
                    JOIN "Collections" c ON c.id = cf."CollectionId"
                    LEFT JOIN "CollectionFileTags" cft ON cft."CollectionFileId" = cf.id
                    LEFT JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId AND c.id::text LIKE :likeCollectionId AND
                        cf.name LIKE :likeQuery ${
                            tags.length
                                ? 'AND (cft."TagName" IN(:tags) OR ct."TagName" IN(:tags))'
                                : ""
                        }
                    ORDER BY ${
                        sort.field === "name"
                            ? "cf.name"
                            : 'cf."takenAt", cf."createdAt"'
                    } ${sort.asc ? "ASC" : "DESC"}`;
        const values = {
            userId: this.userId,
            likeQuery: `%${query}%`,
            likeCollectionId: collectionId ? collectionId : "%",
            tags: tags
        };

        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.id));
    }
}

import Database from "@/db/Database";
import { Op, Order } from "sequelize";
import { isUuidv4 } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { SearchResult } from "../types/search-result";
import { SearchRequest } from "../validators/search-request.validator";

export default class SearchService {
    constructor(private readonly userId: string) {}

    async search(searchRequest: SearchRequest): Promise<SearchResult> {
        const [collectionIds, fileIds] = await Promise.all([
            this.getMatchingCollectionIds(searchRequest),
            this.getMatchingFileIds(searchRequest)
        ]);
        const [collections, files] = await Promise.all([
            this.getCollectionDtos(collectionIds, searchRequest),
            this.getFileDtos(fileIds, searchRequest)
        ]);
        return { collections, files };
    }

    private async getCollectionDtos(
        collectionIds: string[],
        searchRequest: SearchRequest
    ): Promise<CollectionDto[]> {
        const { sort } = searchRequest;
        const db = await Database.getInstance();
        const collections = await db.models.Collection.findAll({
            where: {
                id: {
                    [Op.in]: collectionIds
                }
            },
            include: [db.models.Tag, db.models.CollectionFile],
            order: [
                [
                    sort.field === "name" ? "name" : "createdAt",
                    sort.asc ? "ASC" : "DESC"
                ]
            ]
        });
        return collections.map((collection) => collection.toDto());
    }

    private async getFileDtos(
        fileIds: string[],
        searchRequest: SearchRequest
    ): Promise<CollectionFileDto[]> {
        const {
            sort: { field, asc }
        } = searchRequest;
        const order: Order =
            field === "name"
                ? [["name", asc ? "ASC" : "DESC"]]
                : [
                      ["takenAt", asc ? "ASC" : "DESC"],
                      ["createdAt", asc ? "ASC" : "DESC"]
                  ];
        const db = await Database.getInstance();
        const files = await db.models.CollectionFile.findAll({
            where: {
                id: {
                    [Op.in]: fileIds
                }
            },
            include: db.models.Tag,
            order: order
        });
        return files.map((file) => file.toDto());
    }

    private getMatchingCollectionIds(
        searchRequest: SearchRequest
    ): Promise<string[]> {
        const { query, tags, collectionId, sort, target } = searchRequest;
        if (
            (target !== "all" && target !== "collections") ||
            isUuidv4(collectionId)
        ) {
            return Promise.resolve([]);
        }
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
            likeQuery: query ? `%${query}%` : "%",
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
        const { query, tags, collectionId, sort, target } = searchRequest;
        if (target !== "all" && target !== "files") {
            return Promise.resolve([]);
        }
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
            likeQuery: query ? `%${query}%` : "%",
            likeCollectionId: collectionId ? collectionId : "%",
            tags: tags
        };

        return Database.getInstance()
            .then((db) => db.select(sql, values))
            .then((rows) => rows.map((row: any) => row.id));
    }

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
}

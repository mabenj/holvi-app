import Database from "@/db/Database";

export default class TagService {
    constructor(private readonly userId: string) {}

    async getTags(): Promise<string[]> {
        const db = await Database.getInstance();
        const collectionTags = db
            .select(
                `SELECT DISTINCT ct."TagName" as tag
                    FROM "Collections" c
                    JOIN "CollectionTags" ct ON ct."CollectionId" = c.id
                    WHERE c."UserId"::text = :userId`,
                {
                    userId: this.userId
                }
            )
            .then((rows: any[]) => rows.map((row) => row.tag as string));
        const collectionFileTags = db
            .select(
                `SELECT DISTINCT cft."TagName" as tag
                    FROM "CollectionFiles" cf
                    JOIN "Collections" c ON c.id = cf."CollectionId"
                    JOIN "CollectionFileTags" cft ON cft."CollectionFileId" = cf.id
                    WHERE c."UserId"::text = :userId`,
                {
                    userId: this.userId
                }
            )
            .then((rows: any[]) => rows.map((row) => row.tag as string));

        const [colTags, fileTags] = await Promise.all([
            collectionTags,
            collectionFileTags
        ]);
        return Array.from(new Set([...colTags, ...fileTags]));
    }
}

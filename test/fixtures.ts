import { CollectionFile } from "@/db/models/CollectionFile";
import appConfig from "@/lib/common/app-config";
import Cryptography from "@/lib/common/cryptography";
import { UserFileSystem } from "@/lib/common/user-file-system";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { getTestDatabase } from "./database";

export const TEST_PASSWORD_HASH = "test-password-hash-6f1d2c";
export const TEST_PASSWORD_SALT = "test-password-salt-9a8b7c";

export async function createUser(
    username: string,
    options: { requireSignIn?: boolean } = {}
) {
    const db = await getTestDatabase();
    return db.models.User.create({
        username,
        hash: TEST_PASSWORD_HASH,
        salt: TEST_PASSWORD_SALT,
        ...options
    });
}

export async function createCollection(
    userId: string,
    name: string,
    options: { description?: string; tags?: string[]; createdAt?: Date } = {}
) {
    const db = await getTestDatabase();
    const collection = await db.models.Collection.create({
        name,
        description: options.description ?? null,
        createdAt: options.createdAt,
        UserId: userId
    });
    if (options.tags) {
        await setCollectionTags(collection.id, options.tags);
    }
    return collection;
}

export async function setCollectionTags(collectionId: string, tags: string[]) {
    const db = await getTestDatabase();
    await createTags(tags);
    await db.models.CollectionTag.destroy({
        where: { CollectionId: collectionId }
    });
    await db.models.CollectionTag.bulkCreate(
        tags.map((tag) => ({ TagName: tag, CollectionId: collectionId }))
    );
}

export async function setFileTags(fileId: string, tags: string[]) {
    const db = await getTestDatabase();
    await createTags(tags);
    await db.models.CollectionFileTag.destroy({
        where: { CollectionFileId: fileId }
    });
    await db.models.CollectionFileTag.bulkCreate(
        tags.map((tag) => ({ TagName: tag, CollectionFileId: fileId }))
    );
}

async function createTags(tags: string[]) {
    const db = await getTestDatabase();
    await db.models.Tag.bulkCreate(
        tags.map((tag) => ({ name: tag })),
        { ignoreDuplicates: true }
    );
}

type FileMetadata = Partial<
    Pick<
        CollectionFile,
        | "mimeType"
        | "width"
        | "height"
        | "thumbnailWidth"
        | "thumbnailHeight"
        | "takenAt"
        | "createdAt"
        | "durationInSeconds"
        | "gpsLatitude"
        | "gpsLongitude"
        | "gpsAltitude"
        | "gpsLabel"
        | "blurDataUrl"
    >
> & { tags?: string[] };

/** Where a file's encrypted content is stored in the data directory */
export function encryptedFilePath(
    userId: string,
    collectionId: string,
    fileId: string
) {
    return path.join(appConfig.dataDir, userId, collectionId, fileId);
}

/**
 * Creates a file row and its encrypted content in the data directory, the way uploads store them.
 * Pass createdAt and takenAt to control the file's date and its collection's Last added to.
 */
export async function addFile(
    userId: string,
    collectionId: string,
    name: string,
    plaintext: Buffer,
    { tags, ...metadata }: FileMetadata = {}
) {
    const db = await getTestDatabase();
    const file = await db.models.CollectionFile.create({
        name,
        mimeType: "image/jpeg",
        width: null,
        height: null,
        thumbnailWidth: null,
        thumbnailHeight: null,
        ...metadata,
        CollectionId: collectionId
    });
    if (tags) {
        await setFileTags(file.id, tags);
    }
    const filepath = path.join(appConfig.dataDir, userId, collectionId, file.id);
    await mkdir(path.dirname(filepath), { recursive: true });
    await writeFile(filepath, plaintext);
    await Cryptography.encryptFile(filepath);
    return file;
}

/** Stores an encrypted thumbnail for a file, the way uploads store them. */
export async function addThumbnail(
    userId: string,
    collectionId: string,
    fileId: string,
    plaintext: Buffer
) {
    const filepath = path.join(
        appConfig.dataDir,
        userId,
        collectionId,
        "tn",
        fileId
    );
    await mkdir(path.dirname(filepath), { recursive: true });
    await writeFile(filepath, plaintext);
    await Cryptography.encryptFile(filepath);
}

/** Paths of every file under a directory, relative to it */
export async function listFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const nested = await listFiles(path.join(dir, entry.name));
            files.push(...nested.map((file) => path.join(entry.name, file)));
        } else if (entry.isFile()) {
            files.push(entry.name);
        }
    }
    return files.sort();
}

export async function waitFor<T>(
    read: () => Promise<T>,
    isDone: (value: T) => boolean,
    timeoutMs = 20_000
) {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!isDone(value)) {
        if (Date.now() > deadline) {
            throw new Error(
                `Timed out waiting; last value: ${JSON.stringify(value)}`
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        value = await read();
    }
    return value;
}

/** A file's whole decrypted content, read the way the app reads it */
export async function readDecryptedFile(
    userId: string,
    collectionId: string,
    fileId: string
) {
    const chunks: Buffer[] = [];
    const stream = new UserFileSystem(userId).openDecryptedFile(
        collectionId,
        fileId
    );
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

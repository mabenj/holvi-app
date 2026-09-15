import Database from "@/db/Database";
import appConfig from "@/lib/common/app-config";
import Cryptography from "@/lib/common/cryptography";
import { UserFileSystem } from "@/lib/common/user-file-system";
import { BackupFileRef } from "@/lib/services/backup.service";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import yauzl from "yauzl";
import { getTestDatabase } from "./database";

export async function createUser(username: string) {
    const db = await getTestDatabase();
    return db.models.User.create({ username, hash: "hash", salt: "salt" });
}

export async function createCollection(userId: string, name: string) {
    const db = await getTestDatabase();
    return db.models.Collection.create({ name, UserId: userId });
}

/** Creates a file row and its encrypted content in the data directory, the way uploads store them. */
export async function addFile(
    userId: string,
    collectionId: string,
    name: string,
    plaintext: Buffer,
    mimeType = "image/jpeg"
) {
    const db = await getTestDatabase();
    const file = await db.models.CollectionFile.create({
        name,
        mimeType,
        width: null,
        height: null,
        thumbnailWidth: null,
        thumbnailHeight: null,
        CollectionId: collectionId
    });
    const filepath = path.join(appConfig.dataDir, userId, collectionId, file.id);
    await mkdir(path.dirname(filepath), { recursive: true });
    await writeFile(filepath, plaintext);
    await Cryptography.encryptFile(filepath);
    return file;
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

export function listUserBackupDir(userId: string) {
    return listFiles(path.join(appConfig.backupDir, userId));
}

/**
 * A decrypted-file opener that passes through the first chunk of each file
 * and then holds the stream until released, to observe a backup job mid-run.
 */
export function createHoldingOpener() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const openDecryptedFile = (ref: BackupFileRef) => {
        const real = new UserFileSystem(ref.userId).openDecryptedFile(
            ref.collectionId,
            ref.fileId
        );
        return Readable.from(
            (async function* () {
                for await (const chunk of real) {
                    yield chunk;
                    await released;
                }
            })()
        );
    };
    return { openDecryptedFile, release };
}

export interface ZipEntry {
    name: string;
    data: Buffer;
    compressionMethod: number;
}

/** Whether the zip ends with ZIP64 end-of-central-directory records, which lift the 4 GB and 65,535-entry limits */
export async function hasZip64EndOfCentralDirectory(zipPath: string) {
    const ZIP64_EOCD_SIGNATURE = Buffer.from([0x50, 0x4b, 0x06, 0x06]);
    const ZIP64_EOCD_LOCATOR_SIGNATURE = Buffer.from([0x50, 0x4b, 0x06, 0x07]);
    // ZIP64 EOCD record (56) + locator (20) + EOCD (22), with no archive comment
    const tail = (await readFile(zipPath)).subarray(-98);
    return (
        tail.indexOf(ZIP64_EOCD_SIGNATURE) === 0 &&
        tail.indexOf(ZIP64_EOCD_LOCATOR_SIGNATURE) === 56
    );
}

/** Reads every entry of a zip, in the order they are stored. */
export function readZip(zipPath: string): Promise<ZipEntry[]> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (openError, zip) => {
            if (openError) {
                return reject(openError);
            }
            const entries: ZipEntry[] = [];
            zip.on("error", reject);
            zip.on("end", () => resolve(entries));
            zip.on("entry", (entry: yauzl.Entry) => {
                zip.openReadStream(entry, (streamError, stream) => {
                    if (streamError) {
                        return reject(streamError);
                    }
                    const chunks: Buffer[] = [];
                    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
                    stream.on("error", reject);
                    stream.on("end", () => {
                        entries.push({
                            name: entry.fileName,
                            data: Buffer.concat(chunks),
                            compressionMethod: entry.compressionMethod
                        });
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
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

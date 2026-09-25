import appConfig from "@/lib/common/app-config";
import { UserFileSystem } from "@/lib/common/user-file-system";
import { BackupFileRef } from "@/lib/services/backup.service";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import yauzl from "yauzl";
import { listFiles } from "./fixtures";

// Helpers only the backup tests need. Users, collections, files and tags come from ./fixtures.

export function listUserBackupDir(userId: string) {
    return listFiles(path.join(appConfig.backupDir, userId));
}

const holdingOpenerReleases: (() => void)[] = [];

/** Releases every holding opener, so a job held by a failed test cannot block the instance's queue */
export function releaseHoldingOpeners() {
    holdingOpenerReleases.splice(0).forEach((release) => release());
}

/**
 * A decrypted-file opener that passes through the first chunk of each file
 * and then holds the stream until released, to observe a backup job mid-run.
 */
export function createHoldingOpener() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    holdingOpenerReleases.push(release);
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

/**
 * Extracts a zip onto the real file system, refusing entries that would land
 * outside the target directory, and returns the extracted paths.
 */
export async function extractZip(zipPath: string, targetDir: string) {
    const root = path.resolve(targetDir);
    for (const entry of await readZip(zipPath)) {
        const destination = path.resolve(root, entry.name);
        if (!destination.startsWith(root + path.sep)) {
            throw new Error(`Zip entry '${entry.name}' escapes the target directory`);
        }
        if (entry.name.endsWith("/")) {
            await mkdir(destination, { recursive: true });
        } else {
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, entry.data, { flag: "wx" });
        }
    }
    return listFiles(root);
}

import { stat } from "fs/promises";
import { z } from "zod";
import { InvalidArgumentError } from "../common/errors";
import { getErrorMessage } from "../common/utilities";
import {
    COMPRESSION_STORED,
    ZipEntry,
    ZipFormatError,
    ZipReader
} from "../common/zip-reader";

/** The newest Backup format this version of Holvi can restore */
export const NEWEST_RESTORABLE_FORMAT_VERSION = 2;

const MANIFEST_PATH = "manifest.json";

const isoDate = z.string().datetime();
const count = z.number().int().nonnegative();

const problemSchema = z.object({
    fileId: z.string(),
    collectionId: z.string(),
    name: z.string(),
    kind: z.enum(["skipped", "damaged"]),
    reason: z.string(),
    bytesWritten: z.number().nullable(),
    bytesExpected: z.number().nullable()
});

const manifestSchema = z.object({
    formatVersion: z.number().int().positive(),
    snapshotAt: isoDate,
    user: z.object({ username: z.string() }),
    collections: z.array(
        z.object({ id: z.string().uuid(), metadataPath: z.string() })
    ),
    totals: z.object({ files: count, bytes: count }),
    problems: z.array(problemSchema)
});

const fileSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    backupPath: z.string().nullable(),
    status: z.enum(["included", "skipped", "damaged"]),
    mimeType: z.string(),
    sizeBytes: count.nullable(),
    sha256: z.string().nullable(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    thumbnailWidth: z.number().int().nullable(),
    thumbnailHeight: z.number().int().nullable(),
    takenAt: isoDate.nullable(),
    durationInSeconds: z.number().nullable(),
    gpsLatitude: z.number().nullable(),
    gpsLongitude: z.number().nullable(),
    gpsAltitude: z.number().nullable(),
    gpsLabel: z.string().nullable(),
    blurDataUrl: z.string().nullable(),
    tags: z.array(z.string()),
    createdAt: isoDate,
    updatedAt: isoDate
});

const collectionSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
    // Version 2 only
    coverFileId: z.string().uuid().nullable().optional(),
    openCount: count.optional(),
    lastOpened: isoDate.nullable().optional(),
    tags: z.array(z.string()),
    files: z.array(fileSchema)
});

export type BackupManifest = z.infer<typeof manifestSchema>;
export type BackupFileMetadata = z.infer<typeof fileSchema>;

/** A collection's metadata document, with version 1's missing fields filled in as never set */
export type BackupCollectionMetadata = Omit<
    z.infer<typeof collectionSchema>,
    "coverFileId" | "openCount" | "lastOpened"
> & {
    coverFileId: string | null;
    openCount: number;
    lastOpened: string | null;
};

/** A file the Backup holds whole, and where its bytes are in the zip; entry is null if the zip lacks it */
export interface IncludedFile {
    collectionId: string;
    metadata: BackupFileMetadata & { sizeBytes: number; sha256: string };
    entry: ZipEntry | null;
}

/** A Backup zip whose Manifest and metadata documents are valid */
export interface BackupContents {
    manifest: BackupManifest;
    collections: BackupCollectionMetadata[];
    /** Every file to restore, in the order they are stored in the zip */
    includedFiles: IncludedFile[];
    zipSizeBytes: number;
    zipModifiedAt: Date;
}

/**
 * Reads a Backup's Manifest and metadata documents through the zip's central
 * directory. Throws InvalidArgumentError saying why if it is not a Backup this
 * version of Holvi can restore.
 */
export function readBackup(zipPath: string): Promise<BackupContents> {
    return withBackup(zipPath, async (contents) => contents);
}

/**
 * Reads a Backup like readBackup, then lets `work` stream its files from the
 * zip, which stays open until `work` has finished.
 */
export async function withBackup<T>(
    zipPath: string,
    work: (contents: BackupContents, zip: ZipReader) => Promise<T>
): Promise<T> {
    const { size, mtime } = await stat(zipPath);
    const zip = await openZip(zipPath);
    try {
        const manifest = await readManifest(zip);
        const collections = [];
        for (const { metadataPath } of manifest.collections) {
            collections.push(
                toCollection(
                    await readJson(zip, metadataPath, collectionSchema),
                    manifest.formatVersion
                )
            );
        }
        const contents = {
            manifest,
            collections,
            includedFiles: findIncludedFiles(zip, collections),
            zipSizeBytes: size,
            zipModifiedAt: mtime
        };
        return await work(contents, zip);
    } finally {
        await zip.close();
    }
}

/** When a Backup was taken, from its Manifest; null if it is not a readable Backup */
export async function readSnapshotTime(zipPath: string) {
    try {
        const zip = await openZip(zipPath);
        try {
            const manifest = await readManifest(zip);
            return new Date(manifest.snapshotAt);
        } finally {
            await zip.close();
        }
    } catch {
        return null;
    }
}

async function openZip(zipPath: string) {
    try {
        return await ZipReader.open(zipPath);
    } catch (error) {
        throw notABackup(error);
    }
}

async function readManifest(zip: ZipReader) {
    const raw = await readEntryJson(zip, MANIFEST_PATH);
    const formatVersion = (raw as { formatVersion?: unknown })?.formatVersion;
    if (
        typeof formatVersion === "number" &&
        formatVersion > NEWEST_RESTORABLE_FORMAT_VERSION
    ) {
        throw new InvalidArgumentError(
            `This Backup was made by a newer version of Holvi (format version ${formatVersion}). Update Holvi first.`
        );
    }
    return parse(manifestSchema, raw, "Manifest");
}

async function readJson<T extends z.ZodTypeAny>(
    zip: ZipReader,
    name: string,
    schema: T
): Promise<z.infer<T>> {
    return parse(schema, await readEntryJson(zip, name), `'${name}'`);
}

async function readEntryJson(zip: ZipReader, name: string) {
    const entry = zip.getEntry(name);
    if (!entry) {
        throw new InvalidArgumentError(
            name === MANIFEST_PATH
                ? "Not a Holvi Backup: it has no Manifest"
                : `Not a valid Holvi Backup: '${name}' is missing`
        );
    }
    try {
        return JSON.parse((await zip.readEntry(entry)).toString("utf8"));
    } catch (error) {
        throw notABackup(error, `'${name}' could not be read`);
    }
}

function parse<T extends z.ZodTypeAny>(
    schema: T,
    value: unknown,
    what: string
): z.infer<T> {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new InvalidArgumentError(
            `Not a valid Holvi Backup: ${what} is malformed (${issue.path.join(
                "."
            )}: ${issue.message})`
        );
    }
    return parsed.data;
}

function toCollection(
    { coverFileId, openCount, lastOpened, ...collection }: z.infer<
        typeof collectionSchema
    >,
    formatVersion: number
): BackupCollectionMetadata {
    // Version 1 never recorded these, whatever a document may hold
    const hasHistory = formatVersion >= 2;
    return {
        ...collection,
        coverFileId: hasHistory ? coverFileId ?? null : null,
        openCount: hasHistory ? openCount ?? 0 : 0,
        lastOpened: hasHistory ? lastOpened ?? null : null
    };
}

/** The files to restore, in zip order; Skipped and Damaged files are left out */
function findIncludedFiles(
    zip: ZipReader,
    collections: BackupCollectionMetadata[]
): IncludedFile[] {
    const files: IncludedFile[] = [];
    for (const collection of collections) {
        for (const metadata of collection.files) {
            if (metadata.status !== "included") {
                continue;
            }
            const { backupPath, sizeBytes, sha256 } = metadata;
            if (backupPath === null || sizeBytes === null || sha256 === null) {
                throw new InvalidArgumentError(
                    `Not a valid Holvi Backup: file '${metadata.id}' is included but lacks its path, size or checksum`
                );
            }
            const entry = zip.getEntry(backupPath) ?? null;
            if (entry && entry.compressionMethod !== COMPRESSION_STORED) {
                throw new InvalidArgumentError(
                    `Not a valid Holvi Backup: '${backupPath}' is compressed, which Restore does not support`
                );
            }
            files.push({
                collectionId: collection.id,
                metadata: { ...metadata, sizeBytes, sha256 },
                entry
            });
        }
    }
    // Missing entries last; they are never read
    const offsetOf = (file: IncludedFile) =>
        file.entry?.localHeaderOffset ?? Number.MAX_SAFE_INTEGER;
    return files.sort((a, b) => offsetOf(a) - offsetOf(b));
}

function notABackup(error: unknown, detail?: string) {
    if (error instanceof InvalidArgumentError) {
        return error;
    }
    if (error instanceof ZipFormatError) {
        return new InvalidArgumentError(
            `Not a Holvi Backup: ${error.message.charAt(0).toLowerCase()}${error.message.slice(1)}`
        );
    }
    return new InvalidArgumentError(
        `Not a Holvi Backup: ${detail ?? getErrorMessage(error)}`
    );
}

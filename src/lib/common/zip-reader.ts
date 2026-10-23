import { createReadStream } from "fs";
import { FileHandle, open } from "fs/promises";
import { Readable } from "stream";
import { inflateRawSync } from "zlib";

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EOCD_SIZE = 56;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_SIZE = 30;
const ZIP64_EXTRA_ID = 0x0001;
/** A 32-bit field holding this has its real value in the ZIP64 extra field */
const ZIP64_MARKER = 0xffffffff;

export const COMPRESSION_STORED = 0;
export const COMPRESSION_DEFLATE = 8;

/** The zip is malformed or not a zip at all */
export class ZipFormatError extends Error {}

/** One entry as the central directory records it */
export interface ZipEntry {
    name: string;
    compressionMethod: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
}

/**
 * Reads a zip through its central directory, including ZIP64 zips, without
 * extracting it. Entries are read from their offset in the zip on demand.
 */
export class ZipReader {
    private constructor(
        private readonly zipPath: string,
        private readonly handle: FileHandle,
        /** In central directory order, which is the order they are stored in */
        readonly entries: ZipEntry[]
    ) {}

    /** Reads the central directory; throws ZipFormatError if the file is not a readable zip */
    static async open(zipPath: string) {
        const handle = await open(zipPath, "r");
        try {
            const { size } = await handle.stat();
            const entries = await readCentralDirectory(handle, size);
            return new ZipReader(zipPath, handle, entries);
        } catch (error) {
            await handle.close();
            throw error;
        }
    }

    async close() {
        await this.handle.close();
    }

    getEntry(name: string) {
        return this.entries.find((entry) => entry.name === name);
    }

    /** An entry's whole content, inflated if it is compressed */
    async readEntry(entry: ZipEntry) {
        const start = await this.getDataStart(entry);
        const data = await readAt(this.handle, start, entry.compressedSize);
        switch (entry.compressionMethod) {
            case COMPRESSION_STORED:
                return data;
            case COMPRESSION_DEFLATE:
                try {
                    return inflateRawSync(data);
                } catch (error) {
                    throw new ZipFormatError(
                        `Entry '${entry.name}' could not be inflated`
                    );
                }
            default:
                throw new ZipFormatError(
                    `Entry '${entry.name}' uses unsupported compression method ${entry.compressionMethod}`
                );
        }
    }

    /** Streams a stored (uncompressed) entry's bytes straight from the zip */
    async openStoredEntry(entry: ZipEntry): Promise<Readable> {
        if (entry.compressionMethod !== COMPRESSION_STORED) {
            throw new ZipFormatError(
                `Entry '${entry.name}' is compressed, but only stored entries can be streamed`
            );
        }
        if (entry.compressedSize === 0) {
            return Readable.from([]);
        }
        const start = await this.getDataStart(entry);
        return createReadStream(this.zipPath, {
            start,
            end: start + entry.compressedSize - 1
        });
    }

    /** Where an entry's data starts: after its local header, whose lengths may differ from the central directory's */
    private async getDataStart(entry: ZipEntry) {
        const header = await readAt(
            this.handle,
            entry.localHeaderOffset,
            LOCAL_HEADER_SIZE
        );
        if (header.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
            throw new ZipFormatError(
                `Entry '${entry.name}' has no local header at its offset`
            );
        }
        const nameLength = header.readUInt16LE(26);
        const extraLength = header.readUInt16LE(28);
        return (
            entry.localHeaderOffset +
            LOCAL_HEADER_SIZE +
            nameLength +
            extraLength
        );
    }
}

async function readCentralDirectory(handle: FileHandle, fileSize: number) {
    const tailSize = Math.min(
        fileSize,
        EOCD_SIZE + MAX_COMMENT_SIZE + ZIP64_LOCATOR_SIZE
    );
    const tail = await readAt(handle, fileSize - tailSize, tailSize);
    const eocdPosition = findEndOfCentralDirectory(tail);
    let entryCount = tail.readUInt16LE(eocdPosition + 10);
    let directorySize = tail.readUInt32LE(eocdPosition + 12);
    let directoryOffset = tail.readUInt32LE(eocdPosition + 16);

    const locatorPosition = eocdPosition - ZIP64_LOCATOR_SIZE;
    if (
        locatorPosition >= 0 &&
        tail.readUInt32LE(locatorPosition) === ZIP64_LOCATOR_SIGNATURE
    ) {
        const zip64EocdOffset = toNumber(
            tail.readBigUInt64LE(locatorPosition + 8)
        );
        const record = await readAt(handle, zip64EocdOffset, ZIP64_EOCD_SIZE);
        if (record.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) {
            throw new ZipFormatError("ZIP64 end of central directory is missing");
        }
        entryCount = toNumber(record.readBigUInt64LE(32));
        directorySize = toNumber(record.readBigUInt64LE(40));
        directoryOffset = toNumber(record.readBigUInt64LE(48));
    }

    if (directoryOffset + directorySize > fileSize) {
        throw new ZipFormatError("Central directory lies outside the file");
    }
    const directory = await readAt(handle, directoryOffset, directorySize);
    const entries: ZipEntry[] = [];
    let position = 0;
    for (let i = 0; i < entryCount; i++) {
        const entry = parseCentralHeader(directory, position);
        entries.push(entry.entry);
        position = entry.next;
    }
    return entries;
}

/** The end of central directory record's position in the tail, searched backwards past any comment */
function findEndOfCentralDirectory(tail: Buffer) {
    for (let position = tail.length - EOCD_SIZE; position >= 0; position--) {
        if (
            tail.readUInt32LE(position) === EOCD_SIGNATURE &&
            position + EOCD_SIZE + tail.readUInt16LE(position + 20) ===
                tail.length
        ) {
            return position;
        }
    }
    throw new ZipFormatError("Not a zip file");
}

function parseCentralHeader(directory: Buffer, position: number) {
    if (
        position + CENTRAL_HEADER_SIZE > directory.length ||
        directory.readUInt32LE(position) !== CENTRAL_HEADER_SIGNATURE
    ) {
        throw new ZipFormatError("Central directory is malformed");
    }
    const compressionMethod = directory.readUInt16LE(position + 10);
    let compressedSize = directory.readUInt32LE(position + 20);
    let uncompressedSize = directory.readUInt32LE(position + 24);
    const nameLength = directory.readUInt16LE(position + 28);
    const extraLength = directory.readUInt16LE(position + 30);
    const commentLength = directory.readUInt16LE(position + 32);
    let localHeaderOffset = directory.readUInt32LE(position + 42);
    const nameStart = position + CENTRAL_HEADER_SIZE;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;
    if (next > directory.length) {
        throw new ZipFormatError("Central directory is malformed");
    }
    const name = directory.toString("utf8", nameStart, extraStart);

    // The ZIP64 extra field holds, in this order, only the values whose 32-bit field is the marker
    let extra = extraStart;
    while (extra + 4 <= extraStart + extraLength) {
        const id = directory.readUInt16LE(extra);
        const size = directory.readUInt16LE(extra + 2);
        if (id === ZIP64_EXTRA_ID) {
            let field = extra + 4;
            const nextValue = () => {
                const value = toNumber(directory.readBigUInt64LE(field));
                field += 8;
                return value;
            };
            if (uncompressedSize === ZIP64_MARKER) {
                uncompressedSize = nextValue();
            }
            if (compressedSize === ZIP64_MARKER) {
                compressedSize = nextValue();
            }
            if (localHeaderOffset === ZIP64_MARKER) {
                localHeaderOffset = nextValue();
            }
        }
        extra += 4 + size;
    }

    return {
        entry: {
            name,
            compressionMethod,
            compressedSize,
            uncompressedSize,
            localHeaderOffset
        },
        next
    };
}

async function readAt(handle: FileHandle, position: number, length: number) {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, position);
    if (bytesRead !== length) {
        throw new ZipFormatError("Zip ends unexpectedly");
    }
    return buffer;
}

function toNumber(value: bigint) {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new ZipFormatError("Zip offset or size is too large");
    }
    return Number(value);
}

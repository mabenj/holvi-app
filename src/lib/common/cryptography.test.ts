import crypto from "crypto";
import { createWriteStream } from "fs";
import { mkdtemp, rm, truncate, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";
import v8 from "v8";
import vm from "vm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Cryptography from "./cryptography";

let workDir: string;

beforeEach(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), "holvi-crypto-"));
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

async function createEncryptedFile(plaintext: Buffer) {
    const filepath = path.join(workDir, crypto.randomUUID());
    await writeFile(filepath, plaintext);
    await Cryptography.encryptFile(filepath);
    return filepath;
}

async function readAll(stream: Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function waitForError(stream: Readable) {
    return new Promise<Error>((resolve, reject) => {
        stream.on("error", resolve);
        stream.on("end", () => reject(new Error("Stream ended without error")));
        stream.resume();
    });
}

describe("Cryptography.createDecryptionStream", () => {
    it("returns bytes identical to the original plaintext", async () => {
        const plaintext = crypto.randomBytes(200_003);
        const filepath = await createEncryptedFile(plaintext);

        const decrypted = await readAll(
            Cryptography.createDecryptionStream(filepath)
        );

        expect(decrypted.equals(plaintext)).toBe(true);
    });

    it("returns an empty stream for an empty file", async () => {
        const filepath = await createEncryptedFile(Buffer.alloc(0));

        const decrypted = await readAll(
            Cryptography.createDecryptionStream(filepath)
        );

        expect(decrypted.length).toBe(0);
    });

    it("emits an error event when the file does not exist", async () => {
        const stream = Cryptography.createDecryptionStream(
            path.join(workDir, "missing")
        );

        const error = await waitForError(stream);

        expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    });

    it("emits an error event when the file is too short to hold an IV", async () => {
        const filepath = await createEncryptedFile(Buffer.from("hello"));
        await truncate(filepath, 7);

        const error = await waitForError(
            Cryptography.createDecryptionStream(filepath)
        );

        expect(error.message).toMatch(/too short/i);
    });

    it(
        "keeps memory bounded when streaming a large file into a slow consumer",
        async () => {
            const sizeBytes = 300 * 1024 * 1024;
            const chunkSize = 4 * 1024 * 1024;
            const filepath = path.join(workDir, "large");
            const expectedHash = crypto.createHash("sha256");
            await pipeline(
                Readable.from(
                    (function* () {
                        for (let written = 0; written < sizeBytes; written += chunkSize) {
                            const chunk = crypto.randomBytes(
                                Math.min(chunkSize, sizeBytes - written)
                            );
                            expectedHash.update(chunk);
                            yield chunk;
                        }
                    })()
                ),
                createWriteStream(filepath)
            );
            await Cryptography.encryptFile(filepath);

            // Collect garbage before sampling so only live (buffered) memory is measured
            v8.setFlagsFromString("--expose-gc");
            const gc = vm.runInNewContext("gc") as () => void;
            const liveBufferMemory = () => {
                gc();
                return process.memoryUsage().arrayBuffers;
            };

            const baseline = liveBufferMemory();
            let peak = baseline;
            let received = 0;
            let writes = 0;
            const actualHash = crypto.createHash("sha256");
            const slowConsumer = new Writable({
                highWaterMark: 64 * 1024,
                write(chunk: Buffer, _encoding, callback) {
                    actualHash.update(chunk);
                    received += chunk.length;
                    writes++;
                    if (writes % 64 === 0) {
                        peak = Math.max(peak, liveBufferMemory());
                    }
                    // Throttle to far below disk + decipher throughput
                    if (writes % 16 === 0) {
                        setTimeout(callback, 5);
                    } else {
                        setImmediate(callback);
                    }
                }
            });

            await pipeline(
                Cryptography.createDecryptionStream(filepath),
                slowConsumer
            );

            expect(received).toBe(sizeBytes);
            expect(actualHash.digest("hex")).toBe(expectedHash.digest("hex"));
            expect(peak - baseline).toBeLessThan(16 * 1024 * 1024);
        },
        180_000
    );
});

describe("Cryptography.getDecryptedStreamChunk", () => {
    const plaintext = crypto.randomBytes(1_000);
    let filepath: string;

    beforeEach(async () => {
        filepath = await createEncryptedFile(plaintext);
    });

    it.each([
        { offset: 0, chunkSize: 1_000 },
        { offset: 0, chunkSize: 16 },
        { offset: 15, chunkSize: 2 },
        { offset: 16, chunkSize: 16 },
        { offset: 17, chunkSize: 50 },
        { offset: 31, chunkSize: 33 },
        { offset: 511, chunkSize: 100 },
        { offset: 983, chunkSize: 16 },
        { offset: 990, chunkSize: 100 },
        { offset: 999, chunkSize: 1 },
        { offset: 999, chunkSize: 3_000 }
    ])(
        "returns the correct plaintext for offset $offset and chunk size $chunkSize",
        async ({ offset, chunkSize }) => {
            const expectedEnd = Math.min(offset + chunkSize, plaintext.length) - 1;

            const { stream, start, end, totalSize } =
                await Cryptography.getDecryptedStreamChunk(
                    filepath,
                    offset,
                    chunkSize
                );
            const decrypted = await readAll(stream);

            expect({ start, end, totalSize }).toEqual({
                start: offset,
                end: expectedEnd,
                totalSize: plaintext.length
            });
            expect(
                decrypted.equals(plaintext.subarray(offset, expectedEnd + 1))
            ).toBe(true);
        }
    );

    it("rejects an offset past the end of the file", async () => {
        await expect(
            Cryptography.getDecryptedStreamChunk(filepath, 1_000, 16)
        ).rejects.toThrow(RangeError);
    });
});

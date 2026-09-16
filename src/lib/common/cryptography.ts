import bcrypt from "bcrypt";
import { toBigIntBE, toBufferBE } from "bigint-buffer";
import crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { open, rename, stat } from "fs/promises";
import { PassThrough, Readable, Transform, pipeline } from "stream";
import appConfig from "./app-config";
import { RangeNotSatisfiableError } from "./errors";

const SALT_ROUNDS = 10;
const ENCRYPTION_ALGORITHM = "aes-256-ctr";
const IV_SIZE = 16;
const AES_BLOCK_SIZE = 16;
const MAX_COUNTER = (BigInt(1) << BigInt(IV_SIZE * 8)) - BigInt(1);

/** An inclusive byte range of the decrypted content */
interface ByteRange {
  start: number;
  end: number;
}

export default class Cryptography {
  static async getSaltAndHash(secret: string) {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const saltedHash = await bcrypt.hash(secret, salt);
    return { salt, hash: saltedHash };
  }

  static async matches(hash: string, salt: string, secret: string) {
    const saltedHash = await bcrypt.hash(secret, salt);
    return saltedHash === hash;
  }

  static getUuid() {
    return crypto.randomUUID();
  }

  static async encryptFile(filepath: string) {
    const iv = crypto.randomBytes(IV_SIZE);
    const cipher = Cryptography.getCipher(iv);
    const input = createReadStream(filepath);
    const output = createWriteStream(filepath + ".temp");

    output.write(iv);
    input.pipe(cipher).pipe(output);

    return new Promise<void>((resolve, reject) => {
      output.on("finish", async () => {
        await rename(filepath + ".temp", filepath);
        resolve();
      });
      output.on("error", reject);
    });
  }

  static decrypt(buffer: Buffer) {
    const iv = buffer.subarray(0, IV_SIZE);
    buffer = buffer.subarray(IV_SIZE);
    const decipher = Cryptography.getDecipher(iv);
    const result = Buffer.concat([decipher.update(buffer), decipher.final()]);
    return result;
  }

  /** Size of the decrypted content of an encrypted file */
  static async getDecryptedSize(filepath: string) {
    const { size } = await stat(filepath);
    assertContainsIv(size);
    return size - IV_SIZE;
  }

  /**
   * Opens the decrypted content of an encrypted file (or an inclusive byte
   * range of it) as a stream. Backpressure is respected end to end, and any
   * failure (missing file, read or decipher error) is emitted as an `error`
   * event on the returned stream.
   */
  static createDecryptionStream(filepath: string, range?: ByteRange): Readable {
    const output = new PassThrough();

    Cryptography.readIv(filepath)
      .then((iv) => {
        const offset = range?.start ?? 0;
        const blockNumber = Math.floor(offset / AES_BLOCK_SIZE);
        const blockStart = blockNumber * AES_BLOCK_SIZE;

        const encrypted = createReadStream(filepath, {
          start: IV_SIZE + blockStart,
          end: range ? IV_SIZE + range.end : undefined,
        });
        const decipher = Cryptography.getDecipher(
          Cryptography.getBlockIv(iv, blockNumber)
        );

        pipeline(
          encrypted,
          decipher,
          skipBytes(offset - blockStart),
          output,
          () => {
            // Errors are forwarded to `output` by pipeline
          }
        );
      })
      .catch((error) => output.destroy(error));

    return output;
  }

  /**
   * Opens a chunk of the decrypted content starting at `offset`, for serving
   * range requests. `start` and `end` are the inclusive plaintext byte range
   * the stream will contain.
   */
  static async getDecryptedStreamChunk(
    filepath: string,
    offset: number,
    chunkSize = appConfig.streamChunkSize
  ): Promise<{
    stream: Readable;
    start: number;
    end: number;
    totalSize: number;
  }> {
    const totalSize = await Cryptography.getDecryptedSize(filepath);
    if (!Number.isInteger(offset) || offset < 0 || offset >= totalSize) {
      throw new RangeNotSatisfiableError(
        `Offset ${offset} is outside the file (${totalSize} bytes)`,
        totalSize
      );
    }
    const start = offset;
    const end = Math.min(start + Math.max(chunkSize, 1), totalSize) - 1;
    return {
      stream: Cryptography.createDecryptionStream(filepath, { start, end }),
      start,
      end,
      totalSize,
    };
  }

  private static async readIv(filepath: string) {
    const handle = await open(filepath, "r");
    try {
      const iv = Buffer.alloc(IV_SIZE);
      const { bytesRead } = await handle.read(iv, 0, IV_SIZE, 0);
      assertContainsIv(bytesRead);
      return iv;
    } finally {
      await handle.close();
    }
  }

  /** AES-CTR IV for the given block: the initial IV plus the block number, as a 128-bit counter */
  private static getBlockIv(iv: Buffer, blockNumber: number) {
    const counter = (toBigIntBE(iv) + BigInt(blockNumber)) & MAX_COUNTER;
    return toBufferBE(counter, IV_SIZE);
  }

  private static getCipher(iv: Buffer) {
    return crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      appConfig.encryptionKey,
      iv
    );
  }

  private static getDecipher(iv: Buffer) {
    return crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      appConfig.encryptionKey,
      iv
    );
  }
}

function assertContainsIv(encryptedSize: number) {
  if (encryptedSize < IV_SIZE) {
    throw new Error(
      `Encrypted file is too short to contain an IV (${encryptedSize} bytes)`
    );
  }
}

function skipBytes(count: number) {
  let remaining = count;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (remaining >= chunk.length) {
        remaining -= chunk.length;
        callback();
        return;
      }
      const relevantPart = chunk.subarray(remaining);
      remaining = 0;
      callback(null, relevantPart);
    },
  });
}

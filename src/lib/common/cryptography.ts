import bcrypt from "bcrypt";
import { toBigIntBE, toBufferBE } from "bigint-buffer";
import crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { rename, stat } from "fs/promises";
import { Stream, Transform } from "stream";
import appConfig from "./app-config";

const SALT_ROUNDS = 10;
const ENCRYPTION_ALGORITHM = "aes-256-ctr";
const IV_SIZE = 16;
const AES_BLOCK_SIZE = 16;

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

  static async getDecryptedStreamChunk(
    filepath: string,
    offset: number,
    chunkSize = appConfig.streamChunkSize
  ): Promise<{
    stream: Stream;
    size: number;
    totalSize: number;
  }> {
    // Calculate closest chunk boundary
    const blockNumber = Math.floor(offset / AES_BLOCK_SIZE);
    const closestBoundary = blockNumber * AES_BLOCK_SIZE;
    const delta = offset - closestBoundary;

    // Read encrypted chunk
    const fileSize = await stat(filepath).then((stats) => stats.size);
    const start = Math.min(IV_SIZE + closestBoundary, fileSize - 1);
    const end = Math.min(start + delta + chunkSize - 1, fileSize - 1);
    const encrypted = createReadStream(filepath, { start, end });

    // Calculate correct IV (initial IV + block number)
    const iv = await new Promise<Buffer>((resolve, reject) => {
      const stream = createReadStream(filepath, {
        end: IV_SIZE - 1,
      });
      let iv: Buffer;
      stream.on("error", reject);
      stream.on("data", (data: Buffer) => (iv = data));
      stream.on("close", () => resolve(iv));
    });
    const blockIvInt = toBigIntBE(iv) + BigInt(blockNumber);
    const blockIv = toBufferBE(blockIvInt, 16);
    const decipher = Cryptography.getDecipher(blockIv);

    // Setup read/write stream for decrypted data
    const resultStream = new Transform({
      write(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      },
    });
    let dataProcessed = 0;

    decipher.on("error", (error) => {
      throw error;
    });
    decipher.on("close", () => resultStream.end());
    decipher.on("data", (data: Buffer) => {
      // discard data before the requested offset
      if (dataProcessed + data.length < delta) {
        dataProcessed += data.length;
        return;
      }

      const bytesToTrim = Math.max(0, delta - dataProcessed);
      const relevantPart = data.subarray(bytesToTrim);
      resultStream.write(relevantPart);
      dataProcessed += data.length;
    });

    encrypted.pipe(decipher);

    return {
      stream: resultStream,
      size: end - start,
      totalSize: fileSize - IV_SIZE,
    };
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

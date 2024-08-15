import formidable from "formidable";
import { unlink } from "fs/promises";
import { IncomingMessage } from "http";
import path from "path";
import appConfig from "./app-config";
import Cryptography from "./cryptography";
import { HolviError } from "./errors";
import {
  createDirIfNotExists,
  deleteDirectory,
  moveDirectoryContents,
  tryReadFile,
  writeFile,
} from "./file-system-helpers";
import { ImageHelper } from "./image-helper";
import Log, { LogColor } from "./log";
import { getErrorMessage, isValidDate, timestamp } from "./utilities";
import { VideoHelper } from "./video-helper";
import { Collection } from "@/db/models/Collection";
import { createWriteStream } from "fs";
import archiver from "archiver";
import { Readable } from "stream";

interface ParsedFile {
  filepath: string;
  newFilename: string;
  originalFilename: string | null;
  mimeType: string | null;
  lastModified: Date | null;
}

interface UploadedFile {
  id: string;
  mimeType: string;
  originalFilename: string;
  width?: number;
  height?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  takenAt?: Date;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    label?: string;
  };
  durationInSeconds?: number;
  blurDataUrl?: string;
}

export class UserFileSystem {
  private readonly rootDir: string;
  private readonly tempDir: string;
  private readonly logger: Log;

  constructor(private readonly userId: string) {
    this.rootDir = path.join(appConfig.dataDir, this.userId);
    this.tempDir = path.join(this.rootDir, "temp", Date.now().toString());
    this.logger = new Log("FS", LogColor.YELLOW);
  }

  async backupCollections(collections: Collection[]) {
    const outputDir = path.join(
      this.rootDir,
      "backups",
      `holvi_backup_${timestamp()}`
    );
    // const outputZip = path.join(outputDir, `holvi_backup_${timestamp()}.zip`);
    await createDirIfNotExists(outputDir);
    this.logger.info(
      `Backing up ${collections.length} collections to '${outputDir}'`
    );
    try {
      for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        const files = collection.CollectionFiles || [];
        const tags = collection.Tags?.map((t) => t.name) || [];
        const collectionDir = path.join(outputDir, collection.name);
        await createDirIfNotExists(collectionDir);
        writeFile(path.join(collectionDir, "tags.json"), JSON.stringify(tags));
        writeFile(
          path.join(collectionDir, "collection.json"),
          JSON.stringify({
            name: collection.name,
            description: collection.description,
            createdAt: collection.createdAt,
            updatedAt: collection.updatedAt,
          })
        );
        writeFile(
          path.join(collectionDir, "files.json"),
          JSON.stringify(
            files.map((file) => ({
              name: file.name,
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
            }))
          )
        );

        for (let j = 0; j < files.length; j++) {
          const file = files[j];
          this.logger.info(
            `Backing up collection '${collection.name}' (${i + 1}/${
              collections.length
            }) file '${file.name}' (${j + 1}/${files.length})`
          );
          const { stream } = await this.getFileStream(
            collection.id,
            file.id,
            0,
            Number.POSITIVE_INFINITY
          );
          await createDirIfNotExists(path.join(collectionDir, "files"));
          const writeStream = createWriteStream(
            path.join(collectionDir, "files", file.name)
          );
          stream.pipe(writeStream);
          await new Promise((resolve, reject) => {
            writeStream.on("close", resolve);
            writeStream.on("error", reject);
          });
        }
      }

      this.logger.info(`Writing zip file to '${outputDir}.zip'`);
      const outputStream = createWriteStream(outputDir + ".zip");
      const archive = archiver("zip", {
        zlib: { level: 0 },
      });
      await new Promise((resolve, reject) => {
        outputStream.on("close", resolve);
        outputStream.on("end", resolve);
        archive.on("error", reject);
        archive.on("warning", reject);
        archive.pipe(outputStream);
        archive.directory(outputDir, false);
        archive.finalize();
      });

      this.logger.info(
        `Done creating backup archive (${prettyBytes(
          archive.pointer()
        )} total bytes)`
      );
    } finally {
      await deleteDirectory(outputDir);
    }
  }

  async deleteFileAndThumbnail(collectionId: string, fileId: string) {
    try {
      await unlink(path.join(this.rootDir, collectionId, "tn", fileId));
      await unlink(path.join(this.rootDir, collectionId, fileId));
    } catch (error) {
      this.logger.error(
        `Error deleting file and thumbnail '${collectionId}/${fileId}'`,
        error
      );
      throw error;
    }
  }

  async deleteCollectionDir(collectionId: string) {
    try {
      await deleteDirectory(path.join(this.rootDir, collectionId));
    } catch (error) {
      this.logger.error(
        `Error deleting collection directory '${collectionId}'`,
        error
      );
      throw error;
    }
  }

  async getFileStream(
    collectionId: string,
    fileId: string,
    offset: number,
    chunkSize?: number
  ) {
    try {
      const filePath = path.join(this.rootDir, collectionId, fileId);
      const { stream, size, totalSize } =
        await Cryptography.getDecryptedStreamChunk(filePath, offset, chunkSize);

      return {
        stream,
        totalLengthBytes: totalSize,
        chunkStartEnd: [offset, offset + size] as [number, number],
      };
    } catch (error) {
      this.logger.error(
        `Error fetching file stream (collection: ${collectionId}, file: ${fileId}, start: ${offset})`,
        error
      );
      throw error;
    }
  }

  async readFile(
    collectionId: string,
    fileId: string,
    thumbnail: boolean = false
  ) {
    try {
      const filepath = [this.rootDir, collectionId];
      if (thumbnail) {
        filepath.push("tn");
      }
      filepath.push(fileId);
      const file = await tryReadFile(path.join(...filepath));
      if (!file) {
        throw new HolviError(`Could not read file '${fileId}'`);
      }
      return Cryptography.decrypt(file);
    } catch (error) {
      this.logger.error(
        `Error reading file${
          thumbnail ? " thumbnail" : ""
        } '${collectionId}/${fileId}'`,
        error
      );
      throw error;
    }
  }

  async mergeTempDirToCollectionDir(collectionId: string) {
    try {
      await moveDirectoryContents(
        this.tempDir,
        path.join(this.rootDir, collectionId)
      );
    } catch (error) {
      this.logger.error(
        `Error merging temp dir to collection collection dir '${collectionId}'`,
        error
      );
      throw error;
    }
  }

  async uploadFilesToTempDir(
    req: IncomingMessage
  ): Promise<{ files: UploadedFile[]; errors: string[] }> {
    const timestamp = Date.now().toString();
    this.logger.info(`Uploading files to '${this.tempDir}'`);

    let files: ParsedFile[];
    try {
      files = await parseForm(req, this.tempDir);
    } catch (error) {
      throw new HolviError("Error parsing files from incoming message", error);
    }

    const result: UploadedFile[] = [];
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const { processed, error } = await this.tryProcessFile(
        files[i],
        `${timestamp}_${i}`
      );
      if (!processed || error) {
        this.logger.warn(
          `Could not process file '${files[i].originalFilename}' (${error})`
        );
        errors.push(`Could not process file '${files[i].originalFilename}'`);
        continue;
      }
      result.push(processed);
    }
    return {
      files: result,
      errors: errors,
    };
  }

  async clearTempDir() {
    try {
      await deleteDirectory(this.tempDir);
    } catch (error) {
      this.logger.error(`Error deleting temp dir '${this.tempDir}'`, error);
      throw error;
    }
  }

  private async tryProcessFile(
    file: ParsedFile,
    fallbackName: string
  ): Promise<{ processed?: UploadedFile; error?: string }> {
    try {
      if (!file.newFilename) {
        throw new Error("Uploaded file missing new filename");
      }
      const isImage = file.mimeType?.includes("image") || false;
      const isVideo = file.mimeType?.includes("video") || false;
      if (!isImage && !isVideo) {
        throw new Error("Unsupported file type");
      }

      const filename = file.newFilename;
      const originalFilename =
        file.originalFilename?.split("/").at(-1) ||
        file.originalFilename ||
        fallbackName;

      const filepath = path.join(this.tempDir, filename);
      const thumbnailPath = path.join(this.tempDir, "tn", filename);

      let processed: UploadedFile = {
        id: filename,
        originalFilename,
        mimeType: file.mimeType || "unknown",
      };

      if (isVideo) {
        const {
          width,
          height,
          thumbnailWidth,
          thumbnailHeight,
          durationInSeconds,
        } = await this.processVideo(filepath, thumbnailPath);
        processed = {
          ...processed,
          width,
          height,
          thumbnailWidth,
          thumbnailHeight,
          takenAt: file.lastModified || undefined,
          durationInSeconds,
        };
      } else {
        const { width, height, thumbnailWidth, thumbnailHeight, exif } =
          await this.processImage(filepath, thumbnailPath);
        processed = {
          ...processed,
          width,
          height,
          thumbnailWidth,
          thumbnailHeight,
          gps: exif?.gps,
          takenAt: exif?.takenAt || file.lastModified || undefined,
        };
      }

      let thumbnailBuffer = await tryReadFile(thumbnailPath);
      if (!thumbnailBuffer) {
        throw new HolviError(`Could not read file '${originalFilename}'`);
      }
      processed.blurDataUrl = await ImageHelper.generateBlur(thumbnailBuffer);

      await Cryptography.encryptFile(filepath);
      await Cryptography.encryptFile(thumbnailPath);

      return { processed };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  }

  private async processVideo(videoPath: string, thumbnailPath: string) {
    const UNSUPPORTED_FORMATS = ["avi"];
    const { durationInSeconds, format } = await VideoHelper.getVideoMetadata(
      videoPath
    );

    if (format && UNSUPPORTED_FORMATS.includes(format)) {
      await VideoHelper.convertToMov(videoPath);
    }

    const { width, height, thumbnailWidth, thumbnailHeight } =
      await VideoHelper.generateVideoThumbnail(videoPath, thumbnailPath);

    return {
      width,
      height,
      thumbnailWidth,
      thumbnailHeight,
      durationInSeconds,
    };
  }

  private async processImage(imagePath: string, thumbnailPath: string) {
    const { width, height, thumbnailWidth, thumbnailHeight } =
      await ImageHelper.generateImageThumbnail(imagePath, thumbnailPath);
    const exif = await ImageHelper.getExif(imagePath);
    return { width, height, thumbnailWidth, thumbnailHeight, exif };
  }
}

async function parseForm(
  req: IncomingMessage,
  uploadDir: string,
  onProgress?: (percent: number) => void
): Promise<ParsedFile[]> {
  await createDirIfNotExists(uploadDir);

  const form = formidable({
    maxFileSize: appConfig.maxFileUploadSize,
    maxTotalFileSize: appConfig.maxTotalFileUploadSize,
    uploadDir: uploadDir,
    filename: () => Cryptography.getUuid(),
    filter: (part) =>
      !!part.mimetype?.includes("image") || !!part.mimetype?.includes("video"),
  });

  if (typeof onProgress === "function") {
    let progress = 0;
    form.on("progress", (receivedBytes, expectedBytes) => {
      const newProgress = Math.floor((expectedBytes / receivedBytes) * 100);
      if (newProgress <= progress) {
        return;
      }
      progress = newProgress;
      onProgress(progress);
    });
  }

  const [fields, files] = await form.parse(req);
  return Object.keys(files).flatMap((key) => {
    const lastModified = new Date(parseInt(key, 10));
    const formidableFile = files[key];
    const fileList = Array.isArray(formidableFile)
      ? formidableFile
      : [formidableFile];
    return fileList.map((file) => ({
      filepath: file.filepath,
      newFilename: file.newFilename,
      originalFilename: file.originalFilename,
      mimeType: file.mimetype,
      lastModified: isValidDate(lastModified) ? lastModified : null,
    }));
  });
}

// https://stackoverflow.com/a/28120564
function prettyBytes(bytes: number): string {
  if (bytes == 0) {
    return "0.00 B";
  }
  var e = Math.floor(Math.log(bytes) / Math.log(1024));
  return (
    (bytes / Math.pow(1024, e)).toFixed(2) + " " + " KMGTP".charAt(e) + "B"
  );
}

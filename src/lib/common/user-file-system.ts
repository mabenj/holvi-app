import ExifParser from "exif-parser";
import formidable from "formidable";
import { createReadStream } from "fs";
import {
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    rmdir,
    stat,
    unlink
} from "fs/promises";
import { IncomingMessage } from "http";
import path from "path";
import { promisify } from "util";
import appConfig from "./app-config";
import Cryptography from "./cryptography";
import { HolviError } from "./errors";
import Log, { LogColor } from "./log";
import { getErrorMessage, isValidDate } from "./utilities";

interface ExifData {
    gps?: {
        latitude: number;
        longitude: number;
        altitude?: number;
        label?: string;
    };
    takenAt?: Date;
}

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
        chunkStart: number,
        chunkSize: number
    ) {
        try {
            const filePath = path.join(this.rootDir, collectionId, fileId);
            const fileSize = await stat(filePath).then((stats) => stats.size);
            const chunkEnd = Math.min(chunkStart + chunkSize, fileSize - 1);

            const stream = createReadStream(filePath, {
                start: chunkStart,
                end: chunkEnd
            });

            return {
                stream,
                totalLengthBytes: fileSize,
                chunkStartEnd: [chunkStart, chunkEnd] as [number, number]
            };
        } catch (error) {
            this.logger.error(
                `Error fetching file stream (collection: ${collectionId}, file: ${fileId}, start: ${chunkStart}, size: ${chunkSize})`,
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
            const file = await readBytes(path.join(...filepath));
            return file;
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

    async uploadFilesToTempDir(req: IncomingMessage): Promise<UploadedFile[]> {
        const timestamp = Date.now().toString();
        this.logger.info(`Uploading files to temp dir '${this.tempDir}'`);

        try {
            const files = await parseForm(req, this.tempDir);
            const result: UploadedFile[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.newFilename) {
                    throw new HolviError("Uploaded file missing new filename");
                }
                const isImage = file.mimeType?.includes("image") || false;
                const isVideo = file.mimeType?.includes("video") || false;
                if (!isImage && !isVideo) {
                    throw new Error("Unsupported file type");
                }

                const fallbackName = `${timestamp}_${i}`;
                const filename = file.newFilename;
                const originalFilename =
                    file.originalFilename?.split("/").at(-1) ||
                    file.originalFilename ||
                    fallbackName;

                const { width, height, thumbnailWidth, thumbnailHeight } =
                    await generateThumbnail(
                        isImage ? "image" : "video",
                        path.join(this.tempDir, filename),
                        path.join(this.tempDir, "tn", filename)
                    );
                const exif = isImage
                    ? await this.getExif(path.join(this.tempDir, filename))
                    : undefined;

                result.push({
                    id: filename,
                    originalFilename,
                    mimeType: file.mimeType || "unknown",
                    width,
                    height,
                    thumbnailWidth,
                    thumbnailHeight,
                    gps: exif?.gps,
                    takenAt: exif?.takenAt || file.lastModified || undefined
                });
            }
            return result;
        } catch (error) {
            this.logger.error("Error uploading files to temp dir", error);
            throw error;
        }
    }

    async clearTempDir() {
        try {
            await deleteDirectory(this.tempDir);
        } catch (error) {
            this.logger.error(
                `Error deleting temp dir '${this.tempDir}'`,
                error
            );
            throw error;
        }
    }

    private async getExif(imagePath: string): Promise<ExifData | undefined> {
        const SECONDS_TO_MS = 1000;

        try {
            const buffer = await readBytes(imagePath);
            if (!buffer) {
                throw new HolviError("Could not read image to buffer");
            }
            const parser = ExifParser.create(buffer);
            const {
                tags: {
                    GPSLatitude,
                    GPSLatitudeRef,
                    GPSLongitude,
                    GPSLongitudeRef,
                    GPSAltitude,
                    GPSAltitudeRef,
                    CreateDate
                }
            } = parser.parse();

            const takenAt = CreateDate
                ? new Date(CreateDate * SECONDS_TO_MS)
                : undefined;

            if (
                !GPSLatitude ||
                !GPSLatitudeRef ||
                !GPSLongitude ||
                !GPSLongitudeRef
            ) {
                return { takenAt };
            }

            const latitude = (
                GPSLatitudeRef === "N" ? GPSLatitude : -GPSLatitude
            ) as number;
            const longitude = (
                GPSLongitudeRef === "E" ? GPSLongitude : -GPSLongitude
            ) as number;
            const altitude = GPSAltitude as number;
            let label: string | undefined;

            const res = await fetch(
                `http://api.positionstack.com/v1/reverse?access_key=${appConfig.geoApiKey}&query=${latitude},${longitude}&output=json`
            );
            if (res.status !== 200) {
                this.logger.warn(
                    `Geocoding API request responded with '${res.status}' (${res.statusText})`
                );
            } else {
                const { data } = await res.json();
                let {
                    country,
                    region,
                    county,
                    locality,
                    neighbourhood,
                    name,
                    label: apiLabel
                } = data[0] || {};
                let specificArea = county || locality || neighbourhood;
                if (!specificArea || !country) {
                    label = apiLabel || name || undefined;
                } else {
                    const stringBuilder = [] as string[];
                    if (specificArea?.toLowerCase() !== region?.toLowerCase()) {
                        stringBuilder.push(specificArea);
                    }
                    region && stringBuilder.push(region);
                    if (
                        specificArea?.toLowerCase() !== region?.toLowerCase() &&
                        !region?.includes(country)
                    ) {
                        stringBuilder.push(country);
                    }
                    label = stringBuilder.join(", ") || apiLabel || name;
                }
            }

            return {
                takenAt,
                gps: {
                    latitude,
                    longitude,
                    altitude,
                    label
                }
            };
        } catch (error) {
            this.logger.warn(
                `Could not parse exif data of image '${imagePath}' (${getErrorMessage(
                    error
                )})`
            );
        }
    }
}

async function createDirIfNotExists(dir: string) {
    try {
        await stat(dir);
    } catch (e: any) {
        if (e.code === "ENOENT") {
            await mkdir(dir, { recursive: true });
        } else {
            throw e;
        }
    }
}

async function moveDirectoryContents(sourceDir: string, targetDir: string) {
    await createDirIfNotExists(targetDir);
    const files = await readdir(sourceDir);
    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        const stats = await stat(sourcePath);
        if (stats.isFile()) {
            await rename(sourcePath, targetPath);
        } else {
            await moveDirectoryContents(sourcePath, targetPath);
            await rmdir(sourcePath);
        }
    }
}

async function deleteDirectory(path: string) {
    await rm(path, { recursive: true, force: true });
}

async function readBytes(path: string) {
    try {
        return readFile(path);
    } catch {
        return null;
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
            !!part.mimetype?.includes("image") ||
            !!part.mimetype?.includes("video")
    });

    if (typeof onProgress === "function") {
        let progress = 0;
        form.on("progress", (receivedBytes, expectedBytes) => {
            const newProgress = Math.floor(
                (expectedBytes / receivedBytes) * 100
            );
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
            lastModified: isValidDate(lastModified) ? lastModified : null
        }));
    });
}

async function generateThumbnail(
    filetype: "image" | "video",
    sourceFile: string,
    targetPath: string
): Promise<{
    width: number;
    height: number;
    thumbnailWidth: number;
    thumbnailHeight: number;
}> {
    const maxWidth = 600;
    const maxHeight = 600;
    const dirname = path.dirname(targetPath);
    await createDirIfNotExists(dirname);

    if (filetype === "image") {
        const [{ default: imageSize }, { default: sharp }] = await Promise.all([
            import("image-size"),
            import("sharp")
        ]);
        const sizeOf = promisify(imageSize);
        const { width, height } = await sizeOf(sourceFile).then((result) => ({
            width: result?.width || 0,
            height: result?.height || 0
        }));
        sharp.cache(false);
        const { width: thumbnailWidth, height: thumbnailHeight } = await sharp(
            sourceFile
        )
            .resize({ width: maxWidth, height: maxHeight, fit: "inside" })
            .toFile(targetPath);
        return { width, height, thumbnailWidth, thumbnailHeight };
    }

    const thumbnailTimePercentage = 50;
    const [
        { default: ffmpegStatic },
        { path: ffprobeStatic },
        { default: ffmpeg }
    ] = await Promise.all([
        import("ffmpeg-static"),
        import("ffprobe-static"),
        import("fluent-ffmpeg")
    ]);
    ffmpeg.setFfmpegPath(ffmpegStatic!);
    ffmpeg.setFfprobePath(ffprobeStatic!);
    return new Promise((resolve, reject) =>
        ffmpeg.ffprobe(sourceFile, (error, metadata) => {
            if (error) {
                reject(error);
                return;
            }

            const videoStream = metadata.streams.find(
                (stream) => stream.codec_type === "video"
            );
            let rotation = 0;
            if (videoStream?.rotation) {
                if (typeof videoStream.rotation === "number") {
                    rotation = Math.abs(videoStream.rotation);
                } else {
                    rotation = Math.abs(
                        Number(videoStream.rotation.replace(/\D/g, ""))
                    );
                }
            }
            const videoWidth = videoStream?.width || 0;
            const videoHeight = videoStream?.height || 0;
            const { width: thumbnailWidth, height: thumbnailHeight } =
                calculateResolution({
                    originalWidth: rotation === 90 ? videoHeight : videoWidth,
                    originalHeight: rotation === 90 ? videoWidth : videoHeight,
                    maxWidth,
                    maxHeight
                });

            const thumbnailTime =
                (metadata.format.duration || 1) *
                (thumbnailTimePercentage / 100);
            ffmpeg(sourceFile)
                .on("end", async () => {
                    // takeScreenshots() will add a .png extension
                    await rename(targetPath + ".png", targetPath);
                    resolve({
                        width: videoWidth,
                        height: videoHeight,
                        thumbnailWidth,
                        thumbnailHeight
                    });
                })
                .on("error", (error) => reject(error))
                .takeScreenshots(
                    {
                        count: 1,
                        fastSeek: true,
                        timestamps: [thumbnailTime],
                        size: `${thumbnailWidth}x${thumbnailHeight}`,
                        filename: path.basename(targetPath)
                    },
                    dirname
                );
        })
    );
}

function calculateResolution(options: {
    originalWidth: number;
    originalHeight: number;
    maxWidth: number;
    maxHeight: number;
}) {
    const { originalWidth, originalHeight, maxWidth, maxHeight } = options;
    const ratioW = originalWidth / maxWidth;
    const ratioH = originalHeight / maxHeight;
    const factor = ratioW > ratioH ? ratioW : ratioH;
    return {
        width: Math.floor(originalWidth / factor),
        height: Math.floor(originalHeight / factor)
    };
}

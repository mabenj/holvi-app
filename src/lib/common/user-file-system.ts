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
import { nanoid } from "nanoid";
import path from "path";
import { promisify } from "util";
import appConfig from "./app-config";
import Log from "./log";

interface UploadedFile {
    mimeType: string;
    filename: string;
    originalFilename: string;
    width?: number;
    height?: number;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
}

export class UserFileSystem {
    private readonly rootDir: string;
    private tempDir: string | null = null;

    constructor(private readonly userId: string) {
        this.rootDir = path.join(appConfig.dataDir, this.userId);
    }

    async deleteFileAndThumbnail(collectionId: string, filename: string) {
        await unlink(path.join(this.rootDir, collectionId, "tn", filename));
        await unlink(path.join(this.rootDir, collectionId, filename));
    }

    async deleteCollectionDir(collectionId: string) {
        await deleteDirectory(path.join(this.rootDir, collectionId));
    }

    async getFileStream(
        collectionId: string,
        filename: string,
        chunkStart: number,
        chunkSize: number
    ) {
        const filePath = path.join(this.rootDir, collectionId, filename);
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
    }

    async readFile(
        collectionId: string,
        filename: string,
        thumbnail: boolean = false
    ) {
        const filepath = [this.rootDir, collectionId];
        if (thumbnail) {
            filepath.push("tn");
        }
        filepath.push(filename);
        const file = await readBytes(path.join(...filepath));
        return file;
    }

    async mergeTempDirToCollectionDir(collectionId: string) {
        await moveDirectoryContents(
            this.getTempDir(),
            path.join(this.rootDir, collectionId)
        );
    }

    async uploadFilesToTempDir(req: IncomingMessage): Promise<UploadedFile[]> {
        const timestamp = Date.now().toString();

        const files = await parseForm(req, this.getTempDir());
        const result: UploadedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isImage = file.mimetype?.includes("image") || false;
            const isVideo = file.mimetype?.includes("video") || false;
            if (!isImage && !isVideo) {
                throw new Error("Unsupported file type");
            }

            const fallbackName = `${timestamp}_${i}`;
            const filename = file.newFilename || fallbackName;
            const originalFilename = file.originalFilename || fallbackName;

            const { width, height, thumbnailWidth, thumbnailHeight } =
                await generateThumbnail(
                    isImage ? "image" : "video",
                    path.join(this.getTempDir(), filename),
                    path.join(this.getTempDir(), "tn", filename)
                );
            result.push({
                filename,
                originalFilename,
                mimeType: file.mimetype || "unknown",
                width,
                height,
                thumbnailWidth,
                thumbnailHeight
            });
        }
        return result;
    }

    async clearTempDir() {
        if (!this.tempDir) {
            return;
        }
        await deleteDirectory(this.tempDir);
    }

    private getTempDir() {
        if (!this.tempDir) {
            this.tempDir = path.join(
                this.rootDir,
                "temp",
                Date.now().toString()
            );
        }
        return this.tempDir;
    }
}

async function createDirIfNotExists(dir: string) {
    try {
        await stat(dir);
    } catch (e: any) {
        if (e.code === "ENOENT") {
            await mkdir(dir, { recursive: true });
        } else {
            Log.error("Error creating directory", e);
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
): Promise<formidable.File[]> {
    await createDirIfNotExists(uploadDir);

    const form = formidable({
        maxFileSize: appConfig.maxFileUploadSize,
        maxTotalFileSize: appConfig.maxTotalFileUploadSize,
        uploadDir: uploadDir,
        filename: () => nanoid(),
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
    return Object.keys(files).flatMap((file) => files[file]);
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
            const videoWidth = videoStream?.width || 0;
            const videoHeight = videoStream?.height || 0;
            let thumbnailWidth = 0;
            let thumbnailHeight = 0;
            if (videoWidth > videoHeight) {
                // Landscape video
                thumbnailWidth = Math.min(videoWidth, maxWidth);
                thumbnailHeight = Math.floor(
                    (thumbnailWidth / videoWidth) * videoHeight
                );
            } else {
                // Portrait or square video
                thumbnailHeight = Math.min(videoHeight, maxHeight);
                thumbnailWidth = Math.floor(
                    (thumbnailHeight / videoHeight) * videoWidth
                );
            }

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
                .takeScreenshots({
                    count: 1,
                    fastSeek: true,
                    timestamps: [thumbnailTime],
                    size: `${thumbnailWidth}x${thumbnailHeight}`,
                    filename: targetPath
                });
        })
    );
}

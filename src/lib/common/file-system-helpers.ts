import { mkdir, readFile, readdir, rename, rm, rmdir, stat } from "fs/promises";
import imageSize from "image-size";
import path from "path";
import sharp from "sharp";
import Log from "./log";

export async function createDirIfNotExists(dir: string) {
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

export async function moveDirectoryContents(
    sourceDir: string,
    targetDir: string
) {
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

export function getImageDimensions(path: string) {
    return imageSize(path);
}

export async function generateThumbnail(
    sourceFile: string,
    targetPath: string
) {
    const dirname = path.dirname(targetPath);
    await createDirIfNotExists(dirname);
    const { width, height } = await sharp(sourceFile)
        .resize({ width: 600, height: 600, fit: "inside" })
        .toFile(targetPath);
    return { width, height };
}

export async function deleteDirectory(path: string) {
    await rm(path, { recursive: true, force: true });
}

export async function readBytes(path: string) {
    try {
        return readFile(path);
    } catch {
        return null;
    }
}

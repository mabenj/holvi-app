import { mkdir, readdir, rename, rm, stat } from "fs/promises";
import path from "path";
import Log from "./log";
import imageSize from "image-size";

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
    const files = await readdir(sourceDir);
    await Promise.all(
        files.map((file) =>
            rename(path.join(sourceDir, file), path.join(targetDir, file))
        )
    );
}

export function getImageDimensions(path: string){
    return imageSize(path)
}

export async function deleteDirectory(path: string){
    await rm(path, { recursive: true, force: true });
}

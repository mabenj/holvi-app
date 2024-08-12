import { mkdir, readFile, readdir, rename, rm, rmdir, stat } from "fs/promises";
import path from "path";

export function tryReadFile(path: string) {
  try {
    return readFile(path);
  } catch {
    return null;
  }
}

export function deleteDirectory(path: string) {
  return rm(path, { recursive: true, force: true });
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

export async function createDirIfNotExists(dir: string) {
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

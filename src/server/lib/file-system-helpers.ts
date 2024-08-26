import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  writeFile as writeFileFs,
} from "fs/promises";
import path from "path";

export function tryReadFile(path: string) {
  try {
    return readFile(path);
  } catch {
    return null;
  }
}

export function writeFile(path: string, data: string) {
  return writeFileFs(path, data, { encoding: "utf8" });
}

export function deleteDirectory(path: string) {
  return rm(path, { recursive: true, force: true });
}

export async function moveDirectoryContents(
  sourceDir: string,
  targetDir: string,
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
  } catch (e) {
    const { code } = e as { code: string };
    if (code === "ENOENT") {
      await mkdir(dir, { recursive: true });
    } else {
      throw e;
    }
  }
}

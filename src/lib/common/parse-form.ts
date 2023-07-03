import formidable from "formidable";
import { mkdir, stat } from "fs/promises";
import { nanoid } from "nanoid";
import { NextApiRequest } from "next";
import Log from "./log";

const DEFAULT_MAX_FILE_SIZE_KB = 1024 * 1024 * 1024 * 4; // 4gb
const DEFAULT_TOTAL_MAX_FILE_SIZE_KB = 1024 * 1024 * 1024 * 16; // 16gb

export default function parseForm(
    req: NextApiRequest,
    uploadDir: string,
    onProgress?: (percent: number) => void
): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
    return new Promise(async (resolve, reject) => {
        try {
            await stat(uploadDir);
        } catch (e: any) {
            if (e.code === "ENOENT") {
                await mkdir(uploadDir, { recursive: true });
            } else {
                Log.error("Error creating upload directory", e);
                reject(e);
                return;
            }
        }

        const form = formidable({
            maxFileSize: +(
                process.env.MAX_FILE_SIZE_KB || DEFAULT_MAX_FILE_SIZE_KB
            ),
            maxTotalFileSize: +(
                process.env.MAX_TOTAL_FILE_SIZE_KB ||
                DEFAULT_TOTAL_MAX_FILE_SIZE_KB
            ),
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

        form.parse(req, (error, fields, files) => {
            if (error) {
                reject(error);
            } else {
                resolve({ fields, files });
            }
        });
    });
}
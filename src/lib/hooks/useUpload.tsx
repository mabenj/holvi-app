import { useState } from "react";
import PseudoProgress from "../common/pseudo-progress";

const TIME_CONSTANT_FACTOR = 1 / 50_000;

export function useUpload() {
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const upload = (files: File[], url: string, method: "POST" | "PUT") => {
        const totalSize = files.reduce((acc, curr) => acc + curr.size, 0);
        const formData = new FormData();
        files.forEach((file) => formData.append("file", file));

        return new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const pseudoProgress = new PseudoProgress(
                totalSize * TIME_CONSTANT_FACTOR,
                (progress) => setProgress(Math.floor(progress * 100))
            );

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }
                pseudoProgress.end();
                try {
                    const data = JSON.parse(xhr.response);
                    resolve(data);
                } catch (error) {
                    reject(error);
                } finally {
                    setTimeout(() => {
                        setIsUploading(false);
                        setProgress(0);
                    }, 200);
                }
            };

            xhr.upload.addEventListener("error", (e) => reject(e), false);

            xhr.open(method, url);
            xhr.send(formData);
            setIsUploading(true);
            pseudoProgress.start();
        });
    };

    return { upload, progress, isUploading };
}

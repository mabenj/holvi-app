import { useState } from "react";

export function useUpload(method: "POST" | "PUT", url: string) {
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const upload = (formData: FormData) =>
        new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener(
                "progress",
                (e) =>
                    setProgress(
                        Math.round(Math.round(e.loaded / e.total) * 100)
                    ),
                false
            );

            xhr.upload.addEventListener("error", (e) => reject(e), false);

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }
                setIsUploading(false);
                setProgress(0);
                resolve(JSON.parse(xhr.response));
            };

            xhr.open(method, url);
            xhr.send(formData);
            setIsUploading(true);
        });

    return { upload, progress, isUploading };
}

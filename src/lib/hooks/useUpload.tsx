import { Flex, Spinner, ToastId, useToast } from "@chakra-ui/react";
import { useRef, useState } from "react";

export function useUpload() {
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();
    const toastIdRef = useRef<ToastId | null>(null);

    const upload = (files: File[], url: string, method: "POST" | "PUT") => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        files.forEach((file) => formData.append("file", file));

        return new Promise<any>((resolve, reject) => {
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }
                try {
                    const data = JSON.parse(xhr.response);
                    resolve(data);
                } catch (error) {
                    reject(error);
                } finally {
                    setTimeout(() => {
                        toastIdRef.current && toast.close(toastIdRef.current);
                        setIsUploading(false);
                    }, 200);
                }
            };

            xhr.upload.addEventListener("error", (e) => reject(e), false);
            xhr.upload.addEventListener(
                "progress",
                (e) => {
                    const percent = Math.floor((e.loaded / e.total) * 100);
                    const isProcessing = percent >= 99;
                    if (toastIdRef.current) {
                        toast.update(toastIdRef.current, {
                            description: isProcessing ? (
                                <Flex gap={2} alignItems="center">
                                    <Spinner size="sm" />
                                    <span>Server processing....</span>
                                </Flex>
                            ) : (
                                `Uploading... ${percent}%`
                            )
                        });
                    }
                },
                false
            );

            xhr.open(method, url);
            xhr.send(formData);
            setIsUploading(true);
            toastIdRef.current = toast({
                description: `Uploading...`,
                status: "info",
                duration: null
            });
        });
    };

    return { upload, isUploading };
}

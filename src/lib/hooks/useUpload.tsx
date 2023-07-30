import { Flex, Spinner, ToastId, useToast } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { getErrorMessage } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";

export function useUpload() {
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();
    const toastIdRef = useRef<ToastId | null>(null);

    const uploadCollection = async (
        files: File[],
        collectionName: string
    ): Promise<CollectionDto> => {
        try {
            const response = await upload(
                files,
                `/api/collections/upload?name=${encodeURIComponent(
                    collectionName
                )}`,
                "POST"
            );
            if (response.status === "error" || response.error) {
                throw new Error(response.error);
            }
            const { collection, errors } = response as {
                collection: CollectionDto;
                errors?: string[];
            };
            if (errors && errors.length > 0) {
                toast({
                    description: (
                        <Flex direction="column">
                            <span>
                                Collection &apos;{collection.name}&apos;
                                uploaded with errors
                            </span>
                            <ul>
                                {errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                ))}
                            </ul>
                        </Flex>
                    ),
                    status: "warning"
                });
            } else {
                toast({
                    description: `Collection '${collection.name}' uploaded`,
                    status: "success"
                });
            }

            return collection;
        } catch (error) {
            toast({
                description: `Could not upload collection: ${getErrorMessage(
                    error
                )}`,
                status: "error"
            });
            throw error;
        }
    };

    const uploadCollectionFiles = async (
        files: File[],
        collectionId: string
    ): Promise<CollectionFileDto[]> => {
        try {
            const response = await upload(
                files,
                `/api/collections/${collectionId}/files/upload`,
                "POST"
            );
            if (response.status === "error" || response.error) {
                throw new Error(response.error);
            }
            const { files: collectionFiles, errors } = response as {
                files: CollectionFileDto[];
                errors?: string[];
            };
            if (errors && errors.length > 0) {
                toast({
                    description: (
                        <Flex direction="column">
                            <span>Files uploaded with errors</span>
                            <ul>
                                {errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                ))}
                            </ul>
                        </Flex>
                    ),
                    status: "warning"
                });
            } else {
                toast({
                    description: `${collectionFiles.length} file${
                        collectionFiles.length !== 1 ? "s" : ""
                    } uploaded`,
                    status: "success"
                });
            }
            return collectionFiles;
        } catch (error) {
            toast({
                description: `Could not upload files: ${getErrorMessage(
                    error
                )}`,
                status: "error"
            });
            throw error;
        }
    };

    const upload = (files: File[], url: string, method: "POST" | "PUT") => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        files.forEach((file) =>
            formData.append(file.lastModified.toString(), file)
        );

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

    return { uploadCollection, uploadCollectionFiles, isUploading };
}

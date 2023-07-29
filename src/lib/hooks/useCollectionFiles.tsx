import { useToast } from "@chakra-ui/react";
import { useState } from "react";
import { ApiData } from "../common/api-route";
import { getErrorMessage } from "../common/utilities";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionFileFormData } from "../validators/collection-file.validator";
import { useHttp } from "./useHttp";

export function useCollectionFiles() {
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const http = useHttp();
    const toast = useToast();

    const editFile = async (
        formData: CollectionFileFormData,
        collectionId: string
    ): Promise<CollectionFileDto> => {
        type ResponseData = ApiData<{
            file?: CollectionFileDto;
        }>;
        setIsSaving(true);
        const { data, error } = await http
            .post<ResponseData>(`/api/collections/${collectionId}/files`, {
                payload: formData
            })
            .finally(() => setIsSaving(false));

        if (!data?.file || error) {
            toast({
                description: `Could not edit file: ${getErrorMessage(error)}`,
                status: "error"
            });
            return Promise.reject(error);
        }

        toast({
            description: `Collection '${data.file.name}' modified`,
            status: "success"
        });

        return data.file;
    };

    const deleteFile = async (file: CollectionFileDto) => {
        setIsDeleting(true);
        const { error } = await http
            .delete(`/api/collections/${file.collectionId}/files/${file.id}`)
            .finally(() => setIsDeleting(false));

        if (error) {
            toast({
                description: `Error deleting file '${
                    file.name
                }' (${getErrorMessage(error)})`,
                status: "error"
            });
            return Promise.reject(error);
        }

        toast({
            description: `File '${file.name}' deleted`,
            status: "info"
        });

        return Promise.resolve();
    };

    return {
        isSaving,
        isDeleting,
        editFile,
        deleteFile
    };
}

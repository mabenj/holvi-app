import { useToast } from "@chakra-ui/react";
import { useState } from "react";
import { ApiData } from "../common/api-route";
import { getErrorMessage, isUuidv4 } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFormData } from "../validators/collection.validator";
import { useHttp } from "./useHttp";

export function useCollections() {
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const http = useHttp();
    const toast = useToast();

    const deleteCollection = async (collection: CollectionDto) => {
        setIsDeleting(true);
        const { error } = await http
            .delete(`/api/collections/${collection.id}`)
            .finally(() => setIsDeleting(false));
        if (error) {
            toast({
                description: `Error deleting collection '${
                    collection.name
                }' (${getErrorMessage(error)})`,
                status: "error"
            });
            return Promise.reject(error);
        }

        toast({
            description: `Collection '${collection.name}' deleted`,
            status: "info"
        });

        return Promise.resolve();
    };

    const createCollection = (formData: CollectionFormData) =>
        saveCollection(formData);

    const editCollection = (formData: CollectionFormData, id: string) =>
        saveCollection(formData, id);

    const saveCollection = async (
        formData: CollectionFormData,
        id?: string
    ): Promise<{ nameError: string } | CollectionDto> => {
        const isNew = !isUuidv4(id);
        const url = isNew ? "/api/collections" : `/api/collections/${id}`;
        type ResponseData = ApiData<{
            collection?: CollectionDto;
            nameError?: string;
        }>;
        setIsSaving(true);
        const { data, error } = await http
            .post<ResponseData>(url, {
                payload: formData
            })
            .finally(() => setIsSaving(false));
        if (data && data.nameError) {
            return {
                nameError: data.nameError
            };
        }
        if (!data || !data.collection || error) {
            toast({
                description: `Error ${
                    isNew ? "creating" : "editing"
                } collection (${getErrorMessage(error)})`,
                status: "error"
            });
            return Promise.reject(error);
        }

        toast({
            description: `Collection ${isNew ? "created" : "modified"}`,
            status: "success"
        });

        return data.collection;
    };

    return {
        isDeleting,
        isSaving,
        createCollection,
        editCollection,
        deleteCollection
    };
}

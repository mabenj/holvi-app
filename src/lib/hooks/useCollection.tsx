import { useRouter } from "next/router";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFormData } from "../validators/collection.validator";
import { useCollections } from "./useCollections";
import { useHttp } from "./useHttp";

export function useCollection(collectionId: string) {
    const http = useHttp();
    const router = useRouter();
    const { editCollection, isSaving, deleteCollection, isDeleting } =
        useCollections();

    const fetcher = async (url: string) => {
        type ResponseData = ApiData<{
            collection?: CollectionDto;
        }>;
        const { data, error, statusCode } = await http.get<ResponseData>(url);
        if (statusCode === 404) {
            router.replace("/404", window.location.pathname);
            return;
        }
        if (!data?.collection || error) {
            throw new Error((error as any) || "Could not fetch collection");
        }
        return data.collection;
    };

    const {
        data: collection,
        isLoading,
        mutate
    } = useSWR(`/api/collections/${collectionId}`, fetcher);

    const setCollection = (collection: CollectionDto) => {
        mutate(collection, {
            populateCache: true,
            revalidate: false
        });
    };

    const handleEditCollection = async (data: CollectionFormData) => {
        const edited = await editCollection(data, collectionId);
        if ("nameError" in edited) {
            return edited;
        }
        setCollection(edited);
        return edited;
    };

    const handleDeleteCollection = async () => {
        if (!collection) {
            return;
        }
        await deleteCollection(collection);
        await router.push("/");
    };

    return {
        collection: collection,
        editCollection: handleEditCollection,
        deleteCollection: handleDeleteCollection,
        isLoading,
        isSaving,
        isDeleting
    };
}

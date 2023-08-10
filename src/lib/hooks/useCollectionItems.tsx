import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { caseInsensitiveSorter } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionGridItem } from "../types/collection-grid-item";
import { GridSort } from "../types/grid-sort";
import { useHttp } from "./useHttp";

export function useCollectionItems(collectionId: string, sort: GridSort) {
    const http = useHttp();

    const itemFetcher = async (
        collectionId: string
    ): Promise<CollectionGridItem[]> => {
        const url =
            collectionId === "root"
                ? "/api/collections"
                : `/api/collections/${collectionId}/files`;
        const { data, error } = await http.get(url);
        if (!data || error) {
            throw new Error((error as any) || "Unable to fetch grid data");
        }

        let items: CollectionGridItem[] = [];
        if (collectionId === "root") {
            const { collections } = data as { collections: CollectionDto[] };
            items = collections.map((collection) => ({
                ...collection,
                type: "collection"
            }));
        } else {
            const { files } = data as { files: CollectionFileDto[] };
            items = files.map((file) => ({
                ...file,
                type: file.mimeType.includes("image") ? "image" : "video"
            }));
        }

        return items.sort(caseInsensitiveSorter(sort.field, sort.asc));
    };

    const {
        data: allItems = [],
        isLoading: isFetchingItems,
        mutate: mutateItems
    } = useSWR(collectionId, itemFetcher);

    const tagFetcher = async (url: string) => {
        const { data, error } = await http.get<ApiData<{ tags: string[] }>>(
            url
        );
        if (error) {
            return Promise.reject(error);
        }
        return data?.tags.sort() || [];
    };
    const {
        data: allTags = [],
        isLoading: isFetchingTags,
        mutate: mutateTags
    } = useSWR("/api/tags", tagFetcher);

    const addCollectionItem = (...newItems: CollectionGridItem[]) => {
        mutateItems(
            [
                ...newItems,
                ...allItems.filter((prevItem) =>
                    newItems.every((newItem) => newItem.id !== prevItem.id)
                )
            ],
            {
                populateCache: true,
                revalidate: false
            }
        );
        mutateTags();
    };

    const updateCollectionItem = (item: CollectionGridItem) => {
        const mapFn = (prevItem: CollectionGridItem) =>
            prevItem.id === item.id ? item : prevItem;
        mutateItems(allItems.map(mapFn), {
            populateCache: true,
            revalidate: false
        });
        mutateTags();
    };

    const deleteCollectionItems = (...ids: string[]) => {
        mutateItems(
            allItems.filter((prevItem) => !ids.includes(prevItem.id)),
            {
                populateCache: true,
                revalidate: false
            }
        );
        mutateTags();
    };

    return {
        isFetchingItems,
        isFetchingTags,
        allItems,
        allTags,
        addCollectionItem,
        updateCollectionItem,
        deleteCollectionItems
    };
}

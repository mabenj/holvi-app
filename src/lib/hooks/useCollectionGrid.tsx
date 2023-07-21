import { useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { CollectionGridItem } from "../interfaces/collection-grid-item";
import useDebounce from "./useDebounce";
import { useHttp } from "./useHttp";
import { useUpload } from "./useUpload";

export interface GridSort {
    field: "name" | "timestamp";
    asc: boolean;
}

export function useCollectionGrid(collectionId: string) {
    const [allItems, setAllItems] = useState<CollectionGridItem[]>([]);
    const [searchResult, setSearchResult] = useState<
        CollectionGridItem[] | null
    >(null);
    const [itemsToRender, setItemsToRender] = useState<CollectionGridItem[]>(
        []
    );
    const [isSearching, setIsSearching] = useState(false);
    const [filters, setFilters] = useState(["collections", "images", "videos"]);
    const [sort, setSort] = useState<GridSort>({ field: "name", asc: true });
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery);

    const { upload, isUploading } = useUpload();
    const http = useHttp();
    const toast = useToast();

    const fetcher = async (
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

        if (collectionId === "root") {
            const { collections } = data as { collections: CollectionDto[] };
            return collections.map((collection) => ({
                ...collection,
                type: "collection"
            }));
        }
        const { files } = data as { files: CollectionFileDto[] };
        return files.map((file) => ({
            ...file,
            type: file.mimeType.includes("image") ? "image" : "video"
        }));
    };

    const {
        data,
        isLoading: isFetching,
        mutate
    } = useSWR(collectionId, fetcher);

    useEffect(() => {
        setAllItems(data || []);
    }, [data]);

    // This useEffect is responsible for mutating the useSWR data if needed
    useEffect(() => {
        const stateItemIds = allItems.map((item) => item.id);
        const dataItemIds = data?.map((item) => item.id) || [];
        const isSameContents =
            stateItemIds.length === dataItemIds.length &&
            stateItemIds.every((id) => dataItemIds.includes(id));
        if (!isSameContents) {
            mutate(allItems);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems]);

    // This useEffect is responsible for keeping items to render updated
    useEffect(() => {
        updateItemsToRender();
    }, [allItems, sort, filters, searchResult]);

    useEffect(() => {
        async function search(query: string) {
            if (!debouncedSearchQuery) {
                setSearchResult(null);
            } else if (collectionId === "root") {
                // TODO make request to server and update search result
            } else {
                // TODO necessary data already at client, construct search result based on query
            }
        }

        search(debouncedSearchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]);

    const addItem = (item: CollectionGridItem) => {
        setAllItems((prev) => {
            const next = prev.filter((prevItem) => prevItem.id !== item.id);
            next.push(item);
            return next;
        });
    };

    const updateItem = (item: CollectionGridItem) => {
        setAllItems((prev) =>
            prev.map((prevItem) => (prevItem.id === item.id ? item : prevItem))
        );
    };

    const deleteItem = (id: string) => {
        setAllItems((prev) => prev.filter((prevItem) => prevItem.id !== id));
    };

    const sortItems = (sort: GridSort) => {
        setSort({ ...sort });
    };

    const filterItems = (filters: string[]) => {
        setFilters([...filters]);
    };

    const searchItems = (query: string) => {
        setSearchQuery(query);
    };

    const uploadFiles = (files: File[], collectionName?: string) => {
        // TODO
    };

    const listFiles = () => {
        // TODO
    };

    const updateItemsToRender = () => {
        // TODO
        setItemsToRender([]);
    };

    return {
        isLoading: isFetching || isSearching || isUploading,
        items: itemsToRender,
        filters: filters,
        sort: sort,
        query: searchQuery,
        actions: {
            add: addItem,
            update: updateItem,
            delete: deleteItem,
            sort: sortItems,
            filter: filterItems,
            search: searchItems,
            upload: uploadFiles,
            listFiles: listFiles
        }
    };
}

// SORT AND FILTER
/**
 * const applyFilters = (items: CollectionGridItem[]) => {
        const { filters, query } = state.filter;
        let filtered = [];
        if (filters.includes("collections")) {
            const collections = items.filter(
                ({ type }) => type === "collection"
            );
            filtered.push(...collections);
        }
        if (filters.includes("images")) {
            const images = items.filter(({ type }) => type === "image");
            filtered.push(...images);
        }
        if (filters.includes("videos")) {
            const videos = items.filter(({ type }) => type === "video");
            filtered.push(...videos);
        }
        if (query) {
            filtered = filtered.filter(
                (item) =>
                    item.name.includes(query) ||
                    item.tags?.some((tag) => tag.localeCompare(query) === 0)
            );
        }
        return filtered;
    };

    const sort = (items: CollectionGridItem[]) => {
        const { field, asc } = state.sort;
        const key = field === "name" ? "name" : "timestamp";
        return items.sort(caseInsensitiveSorter(key, asc));
    };
 */

// SEARCH
/**
     * const { data, error } = await http.get<ApiData<SearchResult>>(
                `/api/search?query=${query}`
            );
            let result: CollectionGridItem[] | null = [];
            if (!data || error) {
                toast({
                    description: `Could not search: '${getErrorMessage(
                        error
                    )}'`,
                    status: "error"
                });
                result = null;
            } else {
                const collectionItems: CollectionGridItem[] =
                    data.collections.map((collection) => ({
                        type: "collection",
                        ...collection
                    }));
                const fileItems: CollectionGridItem[] = data.files.map(
                    (file) => ({
                        type: file.mimeType.includes("image")
                            ? "image"
                            : "video",
                        ...file
                    })
                );
                result.push(...[...collectionItems, ...fileItems]);
            }
     */

// UPLOAD
/**
             * if (files.length === 0) {
            return;
        }
        const isCreatingNew = !!collectionName;

        const url = isCreatingNew
            ? `/api/collections/upload?name=${collectionName}`
            : `/api/collections/${collectionId}/files/upload`;
        const response = await upload(files, url, "POST").catch((error) => ({
            status: "error",
            error
        }));
        if (response.status === "error" || response.error) {
            toast({
                description: `Error uploading ${
                    isCreatingNew ? "collection" : "files"
                }: ${getErrorMessage(response.error)}`,
                status: "error"
            });
            return;
        }
        const newItems = isCreatingNew ? [response.collection] : response.files;
        actionDispatcher({ type: "ADD", items: newItems });
        toast({
            description: `Successfully uploaded ${
                isCreatingNew
                    ? `collection ${response.collection.name}`
                    : `${response.files.length} files`
            }`,
            status: "success"
        });
             */

import { useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { caseInsensitiveSorter, getErrorMessage } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { CollectionGridItem } from "../interfaces/collection-grid-item";
import { SearchResult } from "../interfaces/search-result";
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

    const { uploadCollection, uploadCollectionFiles, isUploading } =
        useUpload();
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
        resetSearch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems]);

    // This useEffect is responsible for keeping items to render updated
    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, sort, filters, searchResult]);

    useEffect(() => {
        search(debouncedSearchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]);

    const addItem = (...newItems: CollectionGridItem[]) => {
        setAllItems((prev) => {
            return [
                ...prev.filter((prevItem) =>
                    newItems.every((newItem) => newItem.id !== prevItem.id)
                ),
                ...newItems
            ];
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

    const uploadFiles = async (files: File[], collectionName?: string) => {
        if (files.length === 0) {
            return;
        }
        const isCreatingNew = !!collectionName;
        let successMessage = "";
        if (isCreatingNew) {
            const collection = await uploadCollection(files, collectionName);
            addItem({ ...collection, type: "collection" });
            successMessage = `Collection '${collection.name}' uploaded`;
        } else {
            const collectionFiles = await uploadCollectionFiles(
                files,
                collectionId
            );
            addItem(
                ...collectionFiles.map(
                    (cf) =>
                        ({
                            ...cf,
                            type: cf.mimeType.includes("image")
                                ? "image"
                                : "video"
                        } as CollectionGridItem)
                )
            );
            successMessage = `${collectionFiles.length} files uploaded`;
        }
        toast({
            description: successMessage,
            status: "success"
        });
    };

    const listFiles = () => {
        // TODO
    };

    const search = async (query: string) => {
        setIsSearching(true);
        let result: CollectionGridItem[] | null = [];
        if (!debouncedSearchQuery) {
            result = null;
        } else if (collectionId === "root") {
            const { data, error } = await http.get<ApiData<SearchResult>>(
                `/api/search?query=${query}`
            );
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
        } else {
            // necessary data already at client, construct search result based on query
            result = allItems.filter(
                (item) =>
                    item.name.toLowerCase().includes(query.toLowerCase()) ||
                    item.tags.some(
                        (tag) =>
                            tag.localeCompare(query, undefined, {
                                sensitivity: "base"
                            }) === 0
                    )
            );
        }
        setSearchResult(result);
        setIsSearching(false);
    };

    const updateItemsToRender = () => {
        const itemPool = searchResult || allItems;
        const nextItems: typeof itemPool = [];
        if (filters.includes("collections")) {
            nextItems.push(
                ...itemPool.filter((item) => item.type === "collection")
            );
        }
        if (filters.includes("images")) {
            nextItems.push(...itemPool.filter((item) => item.type === "image"));
        }
        if (filters.includes("videos")) {
            nextItems.push(...itemPool.filter((item) => item.type === "video"));
        }
        setItemsToRender(
            nextItems.sort(caseInsensitiveSorter(sort.field, sort.asc))
        );
    };

    const resetSearch = () => {
        setSearchQuery("")
        setSearchResult(null)
    }

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

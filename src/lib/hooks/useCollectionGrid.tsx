import { useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { caseInsensitiveSorter, getErrorMessage } from "../common/utilities";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionGridItem } from "../types/collection-grid-item";
import { SearchResult } from "../types/search-result";
import useDebounce from "./useDebounce";
import { useHttp } from "./useHttp";
import { useUpload } from "./useUpload";

export interface GridSort {
    field: "name" | "timestamp" | null;
    asc: boolean;
}

export function useCollectionGrid(collectionId: string) {
    const [searchResult, setSearchResult] = useState<
        CollectionGridItem[] | null
    >(null);
    const [itemsToRender, setItemsToRender] = useState<CollectionGridItem[]>(
        []
    );
    const [allFiles, setAllFiles] = useState<CollectionGridItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [filters, setFilters] = useState(["collections", "images", "videos"]);
    const [sort, setSort] = useState<GridSort>({ field: null, asc: true });
    const [isFileOnly, setIsFileOnly] = useState(false);
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
        data: allItems = [],
        isLoading: isFetching,
        mutate
    } = useSWR(collectionId, fetcher);

    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, sort, filters, searchResult, isFileOnly]);

    useEffect(() => {
        search(debouncedSearchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]);

    const addItem = (...newItems: CollectionGridItem[]) => {
        mutate(
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
    };

    const updateItem = (item: CollectionGridItem) => {
        mutate(
            allItems.map((prevItem) =>
                prevItem.id === item.id ? item : prevItem
            ),
            {
                populateCache: true,
                revalidate: false
            }
        );
    };

    const deleteItem = (id: string) => {
        mutate(
            allItems.filter((prevItem) => prevItem.id !== id),
            {
                populateCache: true,
                revalidate: false
            }
        );
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
        if (isCreatingNew) {
            let deduplicatedName = collectionName;
            let isDuplicate = allItems.some(
                (item) =>
                    item.type === "collection" && item.name === deduplicatedName
            );
            let duplicateCount = 1;
            while (isDuplicate) {
                deduplicatedName = `${collectionName} (${++duplicateCount})`;
                isDuplicate = allItems.some(
                    (item) =>
                        item.type === "collection" &&
                        item.name === deduplicatedName
                );
            }

            const collection = await uploadCollection(files, deduplicatedName);
            addItem({ ...collection, type: "collection" });
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
        }
    };

    const toggleIsFileOnly = async () => {
        if (isFileOnly) {
            setIsFileOnly(false);
        } else {
            const { data, error } = await http.get<
                ApiData<{ files: CollectionFileDto[] }>
            >("/api/files/all");
            if (!data || data.status === "error" || error) {
                toast({
                    description: `Error fetching files: ${getErrorMessage(
                        error
                    )}`,
                    status: "error"
                });
                return;
            }
            setAllFiles(
                data.files.map((file) => ({
                    ...file,
                    type: file.mimeType.includes("image") ? "image" : "video"
                }))
            );
            setIsFileOnly(true);
        }
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
        const includeCollections = filters.includes("collections");
        const includeImages = filters.includes("images");
        const includeVideos = filters.includes("videos");

        const itemPool = searchResult || (isFileOnly ? allFiles : allItems);
        let nextItems: typeof itemPool = [];
        itemPool.forEach((item) => {
            if (includeCollections && item.type === "collection") {
                nextItems.push(item);
            } else if (includeImages && item.type === "image") {
                nextItems.push(item);
            } else if (includeVideos && item.type === "video") {
                nextItems.push(item);
            }
        });

        if (sort.field) {
            nextItems = nextItems.sort(
                caseInsensitiveSorter(sort.field, sort.asc)
            );
        }

        setItemsToRender(nextItems);
    };

    const resetSearch = () => {
        setSearchQuery("");
        setSearchResult(null);
    };

    return {
        isLoading: isFetching || isSearching,
        isUploading: isUploading,
        items: itemsToRender,
        filters: filters,
        sort: sort,
        query: searchQuery,
        isFileOnly: isFileOnly,
        actions: {
            add: addItem,
            update: updateItem,
            delete: deleteItem,
            sort: sortItems,
            filter: filterItems,
            search: searchItems,
            upload: uploadFiles,
            toggleIsFileOnly: toggleIsFileOnly
        }
    };
}

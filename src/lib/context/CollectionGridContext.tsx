import { useToast } from "@chakra-ui/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import {
    caseInsensitiveSorter,
    getErrorMessage,
    isUuidv4
} from "../common/utilities";
import useDebounce from "../hooks/useDebounce";
import { useHttp } from "../hooks/useHttp";
import { useUpload } from "../hooks/useUpload";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionGridItem } from "../types/collection-grid-item";
import { GridSort } from "../types/grid-sort";
import { SearchResult } from "../types/search-result";
import { CollectionFileFormData } from "../validators/collection-file-validator";
import { CollectionFormData } from "../validators/collection-validator";

interface CollectionGridState {
    collectionId: string;
    isLoading: boolean;
    isUploading: boolean;
    items: CollectionGridItem[];
    tags: string[];
    filterTags: string[];
    sort: GridSort;
    query: string;
    isFileOnly: boolean;
    actions: {
        toggleIsFileOnly: () => void;
        sort: (sort: GridSort) => void;
        filterTags: (tags: string[]) => void;
        search: (query: string) => void;
        upload: (files: File[], collectionName?: string) => Promise<void>;
        saveCollection: (
            formData: CollectionFormData,
            id?: string
        ) => Promise<{ nameError: string } | void>;
        editFile: (
            formData: CollectionFileFormData,
            id: string
        ) => Promise<void>;
        deleteCollection: (id: string) => Promise<void>;
        deleteFile: (id: string) => Promise<void>;
    };
}

export function useCollectionGrid() {
    return useContext(CollectionGridContext);
}

export function CollectionGridProvider({
    children,
    collectionId
}: {
    children: React.ReactNode;
    collectionId: string;
}) {
    const state = useCollectionGridState(collectionId);

    return (
        <CollectionGridContext.Provider value={state}>
            {children}
        </CollectionGridContext.Provider>
    );
}

function useCollectionGridState(collectionId: string): CollectionGridState {
    const [searchResult, setSearchResult] = useState<
        CollectionGridItem[] | null
    >(null);
    const [itemsToRender, setItemsToRender] = useState<CollectionGridItem[]>(
        []
    );
    const [allFiles, setAllFiles] = useState<CollectionGridItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [filters, setFilters] = useState([] as string[]);
    const [sort, setSort] = useState<GridSort>({ field: null, asc: true });
    const [isFileOnly, setIsFileOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery);

    const { uploadCollection, uploadCollectionFiles, isUploading } =
        useUpload();
    const http = useHttp();
    const toast = useToast();

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
    const { data: allTags = [], mutate: mutateTags } = useSWR(
        "/api/tags",
        tagFetcher
    );

    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, sort, filters, searchResult, isFileOnly]);

    useEffect(() => {
        search(debouncedSearchQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]);

    const saveCollection = async (
        formData: CollectionFormData,
        id?: string
    ): Promise<{ nameError: string } | void> => {
        const isNew = !isUuidv4(id);
        const url = isNew ? "/api/collections" : `/api/collections/${id}`;
        type ResponseData = ApiData<{
            collection?: CollectionDto;
            nameError?: string;
        }>;
        const { data, error } = await http.post<ResponseData>(url, formData);
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
            return Promise.reject();
        }

        toast({
            description: `Collection ${isNew ? "created" : "modified"}`,
            status: "success"
        });
        addItem({
            ...data.collection,
            type: "collection"
        });
    };

    const editFile = async (
        formData: CollectionFileFormData,
        collectionId: string
    ) => {
        type ResponseData = ApiData<{
            file?: CollectionFileDto;
        }>;
        const { data, error } = await http.post<ResponseData>(
            `/api/collections/${collectionId}/files`,
            formData
        );
        if (!data?.file || error) {
            toast({
                description: `Could not edit file: ${getErrorMessage(error)}`,
                status: "error"
            });
            return Promise.reject();
        }
        toast({
            description: `Collection '${data.file.name}' modified`,
            status: "success"
        });
        updateItem({
            ...data.file,
            type: data.file.mimeType.includes("image") ? "image" : "video"
        });
    };

    const deleteCollection = async (id: string) => {
        const { name } = allItems.find((item) => item.id === id) || {};
        const { error } = await http.delete(`/api/collections/${id}`);
        if (error) {
            toast({
                description: `Error deleting collection '${name}' (${getErrorMessage(
                    error
                )})`,
                status: "error"
            });
            return Promise.reject();
        }
        toast({
            description: `Collection '${name}' deleted`,
            status: "info"
        });
        deleteItem(id);
    };

    const deleteFile = async (id: string) => {
        const fileItem = allItems.find((item) => item.id === id);
        if (!fileItem || !("collectionId" in fileItem)) {
            return;
        }

        const { error } = await http.delete(
            `/api/collections/${fileItem.collectionId}/files/${id}`
        );
        if (error) {
            toast({
                description: `Error deleting file '${
                    fileItem.name
                }' (${getErrorMessage(error)})`,
                status: "error"
            });
            return Promise.reject();
        }
        toast({
            description: `File '${fileItem.name}' deleted`,
            status: "info"
        });
        deleteItem(id);
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

    const addItem = (...newItems: CollectionGridItem[]) => {
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

    const updateItem = (item: CollectionGridItem) => {
        mutateItems(
            allItems.map((prevItem) =>
                prevItem.id === item.id ? item : prevItem
            ),
            {
                populateCache: true,
                revalidate: false
            }
        );
        mutateTags();
    };

    const deleteItem = (id: string) => {
        mutateItems(
            allItems.filter((prevItem) => prevItem.id !== id),
            {
                populateCache: true,
                revalidate: false
            }
        );
        mutateTags();
    };

    const sortItems = (sort: GridSort) => {
        setSort({ ...sort });
    };

    const filterTags = (tags: string[]) => {
        setFilters([...tags]);
    };

    const searchItems = (query: string) => {
        setSearchQuery(query);
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
        const includeCollections = filters.includes("collections") || true;
        const includeImages = filters.includes("images") || true;
        const includeVideos = filters.includes("videos") || true;

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

    return {
        collectionId: collectionId,
        isLoading: isFetchingItems || isSearching,
        isUploading: isUploading,
        items: itemsToRender,
        tags: allTags,
        filterTags: filters,
        sort: sort,
        query: searchQuery,
        isFileOnly: isFileOnly,
        actions: {
            toggleIsFileOnly: toggleIsFileOnly,
            sort: sortItems,
            filterTags: filterTags,
            search: searchItems,
            upload: uploadFiles,
            saveCollection: saveCollection,
            editFile: editFile,
            deleteCollection: deleteCollection,
            deleteFile: deleteFile
        }
    };
}

const CollectionGridContext = createContext<CollectionGridState>({
    collectionId: "root",
    isLoading: false,
    isUploading: false,
    items: [],
    tags: [],
    filterTags: [],
    sort: { field: null, asc: true },
    query: "",
    isFileOnly: false,
    actions: {
        sort: () => null,
        filterTags: () => null,
        search: () => null,
        upload: () => Promise.resolve(),
        toggleIsFileOnly: () => null,
        saveCollection: () => Promise.resolve(),
        editFile: () => Promise.resolve(),
        deleteCollection: () => Promise.resolve(),
        deleteFile: () => Promise.resolve()
    }
});

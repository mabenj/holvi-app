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
import { SearchRequest } from "../types/search-request";
import { SearchResult } from "../types/search-result";
import { CollectionFileFormData } from "../validators/collection-file-validator";
import { CollectionFormData } from "../validators/collection-validator";

interface CollectionGridState {
    collectionId: string;
    isLoading: boolean;
    isUploading: boolean;
    items: CollectionGridItem[];
    tags: string[];
    sort: GridSort;
    searchRequest: SearchRequest;
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
    const [sort, setSort] = useState<GridSort>({
        field: "timestamp",
        asc: false
    });
    const [isFileOnly, setIsFileOnly] = useState(false);
    const [searchRequest, setSearchRequest] = useState<SearchRequest>({
        query: "",
        tags: []
    });
    const debouncedSearchRequest = useDebounce(searchRequest);

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
    }, [allItems, sort, searchResult, isFileOnly]);

    useEffect(() => {
        search(debouncedSearchRequest);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchRequest]);

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
        const { data, error } = await http.post<ResponseData>(url, {
            payload: formData
        });
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
            { payload: formData }
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
        setSearchRequest((prev) => ({
            ...prev,
            tags: tags
        }));
    };

    const searchItems = (query: string) => {
        setSearchRequest((prev) => ({
            ...prev,
            query: query
        }));
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

    const search = async (searchRequest: SearchRequest) => {
        let result: CollectionGridItem[] | null = [];
        if (!searchRequest.query && searchRequest.tags.length === 0) {
            result = null;
        } else if (collectionId === "root") {
            setIsSearching(true);
            const { data, error } = await http
                .get<ApiData<SearchResult>>(`/api/search`, {
                    queryParams: {
                        query: searchRequest.query,
                        tags: searchRequest.tags.join(",")
                    }
                })
                .finally(() => setIsSearching(false));
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

            const nameMatches = (item: CollectionGridItem) =>
                item.name
                    .toLowerCase()
                    .includes(searchRequest.query.toLowerCase());
            const tagsMatch = (item: CollectionGridItem) =>
                searchRequest.tags.some((filterTag) =>
                    item.tags.some((itemTag) =>
                        areTagsEqual(filterTag, itemTag)
                    )
                );
            const areTagsEqual = (a: string, b: string) =>
                a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

            result = allItems.filter(
                (item) => nameMatches(item) || tagsMatch(item)
            );
        }
        setSearchResult(result);
    };

    const updateItemsToRender = () => {
        let itemPool = searchResult || (isFileOnly ? allFiles : allItems);
        if (sort.field) {
            itemPool = itemPool.sort(
                caseInsensitiveSorter(sort.field, sort.asc)
            );
        }

        setItemsToRender([...itemPool]);
    };

    return {
        collectionId: collectionId,
        isLoading: isFetchingItems || isSearching,
        isUploading: isUploading,
        items: itemsToRender,
        tags: allTags,
        searchRequest: searchRequest,
        sort: sort,
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
    sort: { field: "timestamp", asc: false },
    searchRequest: {
        query: "",
        tags: []
    },
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

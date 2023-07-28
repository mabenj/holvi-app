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
import { CollectionFileFormData } from "../validators/collection-file.validator";
import { CollectionFormData } from "../validators/collection.validator";
import { SearchRequest } from "../validators/search-request.validator";

interface CollectionGridState {
    collectionId: string;
    isLoading: boolean;
    isUploading: boolean;
    items: CollectionGridItem[];
    tags: string[];
    searchRequest: SearchRequest;
    actions: {
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
    const [isSearching, setIsSearching] = useState(false);
    const [searchRequest, setSearchRequest] = useState<SearchRequest>({
        query: "",
        tags: [],
        sort: {
            field: "timestamp",
            asc: false
        }
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

        return items.sort(
            caseInsensitiveSorter(
                searchRequest.sort.field,
                searchRequest.sort.asc
            )
        );
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

    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, searchResult]);

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
        setSearchRequest((prev) => ({
            ...prev,
            sort: sort
        }));
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

    const search = async (searchRequest: SearchRequest) => {
        if (!searchRequest.query && searchRequest.tags.length === 0) {
            setSearchResult(null);
            return;
        }

        if (collectionId !== "root") {
            searchRequest.collectionId = collectionId;
        }

        setIsSearching(true);
        const { data, error } = await http
            .post<ApiData<SearchResult>>(`/api/search`, {
                payload: searchRequest
            })
            .finally(() => setIsSearching(false));
        if (!data || error) {
            toast({
                description: `Could not search: '${getErrorMessage(error)}'`,
                status: "error"
            });
        } else {
            const collectionItems: CollectionGridItem[] = data.collections.map(
                (collection) => ({
                    type: "collection",
                    ...collection
                })
            );
            const fileItems: CollectionGridItem[] = data.files.map((file) => ({
                type: file.mimeType.includes("image") ? "image" : "video",
                ...file
            }));
            setSearchResult([...collectionItems, ...fileItems]);
        }
    };

    const updateItemsToRender = () => {
        const itemPool = searchResult || allItems;
        setItemsToRender([...itemPool]);
    };

    return {
        collectionId: collectionId,
        isLoading: isFetchingItems || isSearching,
        isUploading: isUploading,
        items: itemsToRender,
        tags: allTags,
        searchRequest: searchRequest,
        actions: {
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
    searchRequest: {
        query: "",
        tags: [],
        sort: { field: "timestamp", asc: false }
    },
    actions: {
        sort: () => null,
        filterTags: () => null,
        search: () => null,
        upload: () => Promise.resolve(),
        saveCollection: () => Promise.resolve(),
        editFile: () => Promise.resolve(),
        deleteCollection: () => Promise.resolve(),
        deleteFile: () => Promise.resolve()
    }
});

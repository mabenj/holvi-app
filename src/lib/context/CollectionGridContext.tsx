import React, { createContext, useContext, useEffect, useState } from "react";
import { useCollectionFiles } from "../hooks/useCollectionFiles";
import { useCollectionItems } from "../hooks/useCollectionItems";
import { useCollectionSearch } from "../hooks/useCollectionSearch";
import { useCollections } from "../hooks/useCollections";
import { useUpload } from "../hooks/useUpload";
import { CollectionDto } from "../types/collection-dto";
import { CollectionFileDto } from "../types/collection-file-dto";
import { CollectionGridItem } from "../types/collection-grid-item";
import { GridSort } from "../types/grid-sort";
import { CollectionFileFormData } from "../validators/collection-file.validator";
import { CollectionFormData } from "../validators/collection.validator";
import { SearchRequest } from "../validators/search-request.validator";

interface CollectionGridState {
    collectionId: string;
    flags: {
        isLoading: boolean;
        isUploading: boolean;
        isSavingCollection: boolean;
        isDeletingCollection: boolean;
        isSavingFile: boolean;
        isDeletingFile: boolean;
        isFetchingTags: boolean;
    };
    items: {
        collections: CollectionGridItem[];
        files: CollectionGridItem[];
    };
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
        ) => Promise<{ nameError: string } | CollectionDto>;
        deleteCollection: (id: string) => Promise<void>;
        editFile: (
            formData: CollectionFileFormData,
            id: string
        ) => Promise<CollectionFileDto>;
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
    const [itemsToRender, setItemsToRender] = useState({
        collections: [] as CollectionGridItem[],
        files: [] as CollectionGridItem[]
    });

    const {
        isSearching,
        searchRequest,
        searchResult,
        onSearch,
        setSearchResult
    } = useCollectionSearch(collectionId);

    const {
        allItems,
        allTags,
        isFetchingItems,
        isFetchingTags,
        addCollectionItem,
        updateCollectionItem,
        deleteCollectionItem
    } = useCollectionItems(collectionId, searchRequest.sort);

    const {
        isSaving: isSavingCollection,
        isDeleting: isDeletingCollection,
        createCollection,
        editCollection,
        deleteCollection
    } = useCollections();

    const {
        isSaving: isSavingFile,
        isDeleting: isDeletingFile,
        deleteFile,
        editFile
    } = useCollectionFiles();

    const { uploadCollection, uploadCollectionFiles, isUploading } =
        useUpload();

    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, searchResult]);

    const handleSaveCollection = async (
        formData: CollectionFormData,
        id?: string
    ) => {
        const result = id
            ? await editCollection(formData, id)
            : await createCollection(formData);
        if ("nameError" in result) {
            return result;
        }
        updateItem({
            ...result,
            type: "collection"
        });
        return result;
    };

    const handleDeleteCollection = async (id: string) => {
        const item = (searchResult || allItems).find((item) => item.id === id);
        if (!item || item.type !== "collection") {
            return Promise.reject("Collection not found");
        }
        await deleteCollection(item);
        deleteItem(id);
    };

    const handleEditFile = async (
        formData: CollectionFileFormData,
        collectionId: string
    ) => {
        const edited = await editFile(formData, collectionId);
        updateItem({
            ...edited,
            type: edited.mimeType.includes("image") ? "image" : "video"
        });
        return edited;
    };

    const handleDeleteFile = async (id: string) => {
        const item = (searchResult || allItems).find((item) => item.id === id);
        if (!item || item.type === "collection") {
            return Promise.reject("File not found");
        }
        await deleteFile(item);
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
        addCollectionItem(...newItems);
        setSearchResult(null);
    };

    const updateItem = (item: CollectionGridItem) => {
        updateCollectionItem(item);
        setSearchResult(
            searchResult?.map((prevItem) =>
                prevItem.id === item.id ? item : prevItem
            ) || null
        );
    };

    const deleteItem = (id: string) => {
        deleteCollectionItem(id);
        setSearchResult(
            searchResult?.filter((prevItem) => prevItem.id !== id) || null
        );
    };

    const sortItems = (sort: GridSort) => {
        onSearch({
            ...searchRequest,
            sort: sort
        });
    };

    const filterTags = (tags: string[]) => {
        onSearch({
            ...searchRequest,
            tags: tags
        });
    };

    const searchItems = (query: string) => {
        onSearch({
            ...searchRequest,
            query: query
        });
    };

    const updateItemsToRender = () => {
        const collections: CollectionGridItem[] = [];
        const files: CollectionGridItem[] = [];
        const itemPool = searchResult || allItems;
        itemPool.forEach((item) => {
            if (item.type === "collection") {
                collections.push(item);
            } else {
                files.push(item);
            }
        });
        setItemsToRender({ collections, files });
    };

    return {
        collectionId: collectionId,
        flags: {
            isLoading: isFetchingItems || isSearching,
            isSavingCollection: isSavingCollection,
            isDeletingCollection: isDeletingCollection,
            isSavingFile: isSavingFile,
            isDeletingFile: isDeletingFile,
            isUploading: isUploading,
            isFetchingTags: isFetchingTags
        },
        items: itemsToRender,
        tags: allTags,
        searchRequest: searchRequest,
        actions: {
            sort: sortItems,
            filterTags: filterTags,
            search: searchItems,
            upload: uploadFiles,
            saveCollection: handleSaveCollection,
            deleteCollection: handleDeleteCollection,
            editFile: handleEditFile,
            deleteFile: handleDeleteFile
        }
    };
}

const CollectionGridContext = createContext<CollectionGridState>({
    collectionId: "root",
    flags: {
        isLoading: false,
        isSavingCollection: false,
        isDeletingCollection: false,
        isSavingFile: false,
        isDeletingFile: false,
        isUploading: false,
        isFetchingTags: false
    },
    items: {
        collections: [],
        files: []
    },
    tags: [],
    searchRequest: {
        query: "",
        tags: [],
        sort: { field: "timestamp", asc: false },
        target: "collections"
    },
    actions: {
        sort: () => null,
        filterTags: () => null,
        search: () => null,
        upload: () => Promise.reject(),
        saveCollection: () => Promise.reject(),
        deleteCollection: () => Promise.reject(),
        editFile: () => Promise.reject(),
        deleteFile: () => Promise.reject()
    }
});

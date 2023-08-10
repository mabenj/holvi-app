import React, { createContext, useContext, useEffect, useState } from "react";
import { useCollectionFiles } from "../hooks/useCollectionFiles";
import { useCollectionItems } from "../hooks/useCollectionItems";
import { useCollectionSearch } from "../hooks/useCollectionSearch";
import { useCollections } from "../hooks/useCollections";
import { useItemSelect } from "../hooks/useItemSelect";
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
        isDeletingSelection: boolean;
        isFetchingTags: boolean;
        isSelectModeOn: boolean;
    };
    items: {
        collections: CollectionGridItem[];
        files: CollectionGridItem[];
    };
    tags: string[];
    selection: { [id: string]: boolean };
    searchRequest: SearchRequest;
    actions: {
        sort: (sort: GridSort) => void;
        filterTags: (tags: string[]) => void;
        search: (query: string) => void;
        upload: (files: File[]) => Promise<void>;
        saveCollection: (
            formData: CollectionFormData,
            id?: string,
            files?: File[]
        ) => Promise<{ nameError: string } | CollectionDto>;
        deleteCollection: (id: string) => Promise<void>;
        editFile: (
            formData: CollectionFileFormData,
            id: string
        ) => Promise<CollectionFileDto>;
        toggleSelectMode: () => void;
        toggleSelection: (id: string) => void;
        deleteSelected: () => Promise<void>;
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
        deleteCollectionItems
    } = useCollectionItems(collectionId, searchRequest.sort);

    const {
        isSaving: isSavingCollection,
        isDeleting: isDeletingCollection,
        createCollection,
        editCollection,
        deleteCollection
    } = useCollections();

    const { isSaving: isSavingFile, editFile } = useCollectionFiles();

    const { uploadCollectionFiles, isUploading } = useUpload();

    const {
        isSelectModeOn,
        toggleSelectMode,
        toggleSelected,
        selection,
        deleteSelected,
        isDeleting: isDeletingSelection
    } = useItemSelect();

    useEffect(() => {
        updateItemsToRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allItems, searchResult]);

    const handleSaveCollection = async (
        formData: CollectionFormData,
        id?: string,
        files?: File[]
    ) => {
        let result = id
            ? await editCollection(formData, id)
            : await createCollection(formData);
        if ("nameError" in result) {
            return result;
        }

        if (files?.length) {
            try {
                const { collection, files: collectionFiles } =
                    await uploadCollectionFiles(files, result.id);
                result = collection;
            } catch (error) {
                await deleteCollection(result);
                throw error;
            }
        }

        if (id) {
            updateItem({ ...result, type: "collection" });
        } else {
            addItem({ ...result, type: "collection" });
        }
        return result;
    };

    const handleDeleteCollection = async (id: string) => {
        const item = (searchResult || allItems).find((item) => item.id === id);
        if (!item || item.type !== "collection") {
            return Promise.reject("Collection not found");
        }
        await deleteCollection(item);
        deleteItems(id);
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

    const handleDeleteSelected = async () => {
        const deletedIds = await deleteSelected();
        deleteItems(...deletedIds);
    };

    const uploadFiles = async (files: File[]) => {
        if (files.length === 0) {
            return;
        }
        const { files: collectionFiles } = await uploadCollectionFiles(
            files,
            collectionId
        );
        addItem(
            ...collectionFiles.map(
                (cf) =>
                    ({
                        ...cf,
                        type: cf.mimeType.includes("image") ? "image" : "video"
                    } as CollectionGridItem)
            )
        );
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

    const deleteItems = (...ids: string[]) => {
        deleteCollectionItems(...ids);
        setSearchResult(
            searchResult?.filter((prevItem) => !ids.includes(prevItem.id)) ||
                null
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
        const itemPool =
            isSearching || isFetchingItems ? [] : searchResult || allItems;
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
            isDeletingSelection: isDeletingSelection,
            isUploading: isUploading,
            isFetchingTags: isFetchingTags,
            isSelectModeOn: isSelectModeOn
        },
        items: itemsToRender,
        tags: allTags,
        selection: selection,
        searchRequest: searchRequest,
        actions: {
            sort: sortItems,
            filterTags: filterTags,
            search: searchItems,
            upload: uploadFiles,
            saveCollection: handleSaveCollection,
            deleteCollection: handleDeleteCollection,
            editFile: handleEditFile,
            toggleSelectMode: toggleSelectMode,
            toggleSelection: toggleSelected,
            deleteSelected: handleDeleteSelected
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
        isDeletingSelection: false,
        isUploading: false,
        isFetchingTags: false,
        isSelectModeOn: false
    },
    items: {
        collections: [],
        files: []
    },
    tags: [],
    selection: {},
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
        toggleSelectMode: () => null,
        toggleSelection: () => null,
        deleteSelected: () => Promise.reject()
    }
});

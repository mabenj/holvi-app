import { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { collectionsToGridItems, filesToGridItems } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { CollectionGridItem } from "../interfaces/collection-grid-item";

interface CollectionGridContext {
    rootCollectionId: string;
    rootCollection: CollectionDto | null;
    setRootCollection: React.Dispatch<
        React.SetStateAction<CollectionDto | null>
    >;
    gridItems: CollectionGridItem[];
    setGridItems: React.Dispatch<React.SetStateAction<CollectionGridItem[]>>;
    isLoading: boolean;
}

const CollectionGridContext = createContext<CollectionGridContext>({
    rootCollectionId: "root",
    rootCollection: null,
    setRootCollection: () => null,
    gridItems: [],
    setGridItems: () => null,
    isLoading: false
});

export function useCollectionGrid() {
    return useContext(CollectionGridContext);
}

export function CollectionGridProvider({
    children,
    rootCollectionId = "root"
}: {
    children: React.ReactNode;
    rootCollectionId?: string;
}) {
    const { data, isLoading, error } = useSWR(rootCollectionId, fetcher);
    const [rootCollection, setRootCollection] = useState<CollectionDto | null>(
        null
    );
    const [gridItems, setGridItems] = useState<CollectionGridItem[]>([]);

    useEffect(() => {
        if (!data) {
            return;
        }
        setRootCollection(data.collection || null);
        setGridItems([
            ...collectionsToGridItems(data.collections),
            ...filesToGridItems(data.files)
        ]);
    }, [data]);

    return (
        <CollectionGridContext.Provider
            value={{
                rootCollectionId,
                rootCollection,
                setRootCollection,
                gridItems,
                setGridItems,
                isLoading
            }}>
            {children}
        </CollectionGridContext.Provider>
    );
}

async function fetcher(collectionId: string): Promise<{
    collection?: CollectionDto;
    files: CollectionFileDto[];
    collections: CollectionDto[];
}> {
    if (collectionId === "root") {
        const res = await fetch("/api/collections");
        const { collections } = await res.json();
        return { collections, files: [] };
    }
    const res = await fetch(`/api/collections/${collectionId}/files`);
    const { collection, files } = await res.json();
    return { collection, files, collections: [] };
}

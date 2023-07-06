import { useToast } from "@chakra-ui/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { caseInsensitiveSorter } from "../common/utilities";
import { CollectionDto } from "../interfaces/collection-dto";

interface CollectionsContext {
    collections: CollectionDto[];
    setCollections: React.Dispatch<React.SetStateAction<CollectionDto[]>>;
    isLoading: boolean;
}

const CollectionsContext = createContext<CollectionsContext>({
    isLoading: false,
    collections: [],
    setCollections: () => null
});

export function useCollections() {
    return useContext(CollectionsContext);
}

export function CollectionsProvider({
    children
}: {
    children: React.ReactNode;
}) {
    const { data, isLoading, error } = useSWR<CollectionDto[]>(
        "/api/collections",
        fetcher
    );
    const [collections, setCollections] = useState<CollectionDto[]>([]);
    const toast = useToast();

    useEffect(() => setCollections(data || []), [data]);

    useEffect(() => {
        if (!error) {
            return;
        }
        toast({
            description: "Error fetching collections",
            status: "error"
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    return (
        <CollectionsContext.Provider
            value={{ collections, setCollections, isLoading }}>
            {children}
        </CollectionsContext.Provider>
    );
}

const fetcher = (url: string) =>
    fetch(url).then(async (response) => {
        const data = await response.json();
        if (data.status !== "ok" || data.error) {
            throw new Error(data.error);
        }
        return (data.collections as CollectionDto[]).sort(
            caseInsensitiveSorter("name")
        );
    });

import { useToast } from "@chakra-ui/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { caseInsensitiveSorter } from "../common/utilities";
import { Collection } from "../interfaces/collection";

interface CollectionsContext {
    collections: Collection[];
    setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
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
    const { data, isLoading, error } = useSWR<Collection[]>(
        "/api/collections/getAll",
        fetcher
    );
    const [collections, setCollections] = useState<Collection[]>([]);
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
    fetch(url)
        .then((r) => {
            console.log("getting all");
            return r.json();
        })
        .then((data) =>
            data.status === "ok"
                ? (data.collections as Collection[]).sort(
                      caseInsensitiveSorter("name")
                  )
                : []
        );

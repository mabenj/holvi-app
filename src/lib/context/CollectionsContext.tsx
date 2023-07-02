import React, { createContext, useContext, useState } from "react";
import { Collection } from "../interfaces/collection";

const CollectionsContext = createContext<
    [Collection[], React.Dispatch<React.SetStateAction<Collection[]>>]
>([[], () => []]);

export function useCollections() {
    return useContext(CollectionsContext);
}

export function CollectionsProvider({
    children, initialCollections
}: {
    children: React.ReactNode;
    initialCollections: Collection[]
}) {
    const [collections, setCollections] = useState<Collection[]>(initialCollections);

    return (
        <CollectionsContext.Provider value={[collections, setCollections]}>
            {children}
        </CollectionsContext.Provider>
    );
}

import { useToast } from "@chakra-ui/react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { ApiData } from "../common/api-route";
import { getErrorMessage } from "../common/utilities";
import { CollectionGridItem } from "../types/collection-grid-item";
import { SearchResult } from "../types/search-result";
import { SearchRequest } from "../validators/search-request.validator";
import useDebounce from "./useDebounce";
import { useHttp } from "./useHttp";

export function useCollectionSearch(collectionId: string) {
    const [searchRequest, setSearchRequest] = useState<SearchRequest>({
        collectionId: collectionId,
        query: "",
        target: "all",
        tags: [],
        sort: {
            field: "timestamp",
            asc: false
        }
    });
    const debouncedRequest = useDebounce(searchRequest);
    const http = useHttp();
    const toast = useToast();

    const shouldSearchRef = useRef(false);

    const searchFetcher = async ([url, request]: [
        url: string,
        request: SearchRequest
    ]): Promise<CollectionGridItem[] | null> => {
        if (!shouldSearchRef.current) {
            return null;
        }

        request = structuredClone(request);
        if (collectionId === "root") {
            delete request.collectionId;
        }
        if (
            collectionId === "root" &&
            !request.query &&
            request.tags.length === 0
        ) {
            request.target = "collections";
        }

        const { data, error } = await http.post<ApiData<SearchResult>>(url, {
            payload: request
        });
        if (!data || error) {
            toast({
                description: `Could not search: '${getErrorMessage(error)}'`,
                status: "error"
            });
            return [];
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
            return [...collectionItems, ...fileItems];
        }
    };

    const {
        data: searchResult = null,
        isLoading,
        mutate
    } = useSWR(["/api/search", debouncedRequest], searchFetcher);

    const onSearch = (searchRequest: SearchRequest) => {
        shouldSearchRef.current = true;
        setSearchRequest(searchRequest);
    };

    const setSearchResult = (value: CollectionGridItem[] | null) =>
        mutate(value, { populateCache: true, revalidate: false });

    return {
        searchRequest: searchRequest,
        isSearching: isLoading,
        searchResult: searchResult,
        onSearch: onSearch,
        setSearchResult: setSearchResult
    };
}

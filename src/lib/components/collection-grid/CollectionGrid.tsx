import { caseInsensitiveSorter } from "@/lib/common/utilities";
import { useHttp } from "@/lib/hooks/useHttp";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
import { Flex, SimpleGrid } from "@chakra-ui/react";
import { useEffect, useReducer, useState } from "react";
import useSWR from "swr";
import IfNotLoading from "../ui/IfNotLoading";
import PhotoViewer from "../photo-viewer/PhotoViewer";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

interface CollectionGridState {
    items: CollectionGridItem[];
    filter: {
        filters: string[];
        query: string;
    };
    sort: {
        field: string;
        asc: boolean;
    };
    search: {
        isSearching: boolean;
        result: CollectionGridItem[] | null;
    };
}

export type CollectionGridAction =
    | { type: "SET"; items: CollectionGridItem[] }
    | { type: "ADD"; items: CollectionGridItem[] }
    | { type: "UPDATE"; item: CollectionGridItem }
    | { type: "DELETE"; id: string }
    | { type: "SORT"; field: string; asc: boolean }
    | { type: "FILTER"; filters: string[]; query?: string }
    | { type: "SEARCH_START" }
    | {
          type: "SEARCH_END";
          result: CollectionGridItem[] | null;
      };

interface CollectionGridProps {
    collectionId: string;
}

export default function CollectionGrid({ collectionId }: CollectionGridProps) {
    const [state, dispatch] = useReducer(reducer, {
        items: [],
        filter: {
            filters: ["collections", "images", "videos"],
            query: ""
        },
        sort: {
            field: "name",
            asc: true
        },
        search: {
            isSearching: false,
            result: null
        }
    });
    const [itemsToRender, setItemsToRender] = useState(
        [] as CollectionGridItem[]
    );
    const http = useHttp();

    const fetcher = async (
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
        data,
        isLoading: isFetching,
        mutate
    } = useSWR(collectionId, fetcher);

    const isLoading = isFetching || state.search.isSearching;

    useEffect(() => {
        const stateItemIds = state.items.map((item) => item.id);
        const dataItemIds = data?.map((item) => item.id) || [];
        const sameContents =
            stateItemIds.length === dataItemIds.length &&
            stateItemIds.every((id) => dataItemIds.includes(id));
        if (sameContents) {
            return;
        }
        mutate(state.items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.items]);

    useEffect(() => {
        if (!data) {
            return;
        }

        dispatch({ type: "SET", items: data });
    }, [data]);

    useEffect(() => {
        setItemsToRender(
            sort(applyFilters(state.search.result || state.items))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.items, state.sort, state.filter, state.search.result]);

    const applyFilters = (items: CollectionGridItem[]) => {
        const { filters, query } = state.filter;
        let filtered = [];
        if (filters.includes("collections")) {
            const collections = items.filter(
                ({ type }) => type === "collection"
            );
            filtered.push(...collections);
        }
        if (filters.includes("images")) {
            const images = items.filter(({ type }) => type === "image");
            filtered.push(...images);
        }
        if (filters.includes("videos")) {
            const videos = items.filter(({ type }) => type === "video");
            filtered.push(...videos);
        }
        if (query) {
            filtered = filtered.filter(
                (item) =>
                    item.name.includes(query) ||
                    item.tags?.some((tag) => tag.localeCompare(query) === 0)
            );
        }
        return filtered;
    };

    const sort = (items: CollectionGridItem[]) => {
        const { field, asc } = state.sort;
        const key = field === "name" ? "name" : "timestamp";
        return items.sort(caseInsensitiveSorter(key, asc));
    };

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar
                isLoading={isLoading}
                actionDispatcher={dispatch}
                collectionId={collectionId}
            />
            <IfNotLoading isLoading={isLoading}>
                <SimpleGrid columns={[3, 3, 3, 4]} spacing={[1, 1, 1, 2]}>
                    {itemsToRender.map((item) => (
                        <CollectionGridCard
                            key={item.id}
                            onDeleted={(id) => dispatch({ type: "DELETE", id })}
                            onUpdated={(item) =>
                                dispatch({ type: "UPDATE", item })
                            }
                            item={item}
                        />
                    ))}
                </SimpleGrid>
                <PhotoViewer items={itemsToRender} />
            </IfNotLoading>
        </Flex>
    );
}

function reducer(
    state: CollectionGridState,
    action: CollectionGridAction
): CollectionGridState {
    switch (action.type) {
        case "SET": {
            state.items = [...action.items];
            break;
        }
        case "ADD": {
            state.items = state.items.filter((item) =>
                action.items.every(({ id }) => id !== item.id)
            );
            state.items = [...state.items, ...action.items];
            break;
        }
        case "UPDATE": {
            state.items = state.items.map((item) =>
                item.id === action.item.id ? action.item : item
            );
            break;
        }
        case "DELETE": {
            state.items = state.items.filter((item) => item.id !== action.id);
            break;
        }
        case "SORT": {
            state.sort = {
                field: action.field,
                asc: action.asc
            };
            break;
        }
        case "FILTER": {
            state.filter = {
                filters: action.filters,
                query: action.query || ""
            };
            break;
        }
        case "SEARCH_START": {
            state.search.isSearching = true;
            state.search.result = null;
            break;
        }
        case "SEARCH_END": {
            state.search.isSearching = false;
            state.search.result = action.result;
            break;
        }
        default:
            return state;
    }
    return { ...state };
}

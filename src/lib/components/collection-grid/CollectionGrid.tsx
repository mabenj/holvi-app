import { caseInsensitiveSorter } from "@/lib/common/utilities";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
import { Flex, SimpleGrid, Spinner } from "@chakra-ui/react";
import { useEffect, useReducer } from "react";
import { PhotoProvider } from "react-photo-view";
import useSWR from "swr";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

interface CollectionGridState {
    items: CollectionGridItem[];
    filters: string[];
    query: string;
    sort: {
        field: string;
        asc: boolean;
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
          type: "SEARCH_SUCCESS";
          collections: CollectionDto[];
          files: CollectionFileDto[];
      };

interface CollectionGridProps {
    collectionId: string;
}

export default function CollectionGrid({ collectionId }: CollectionGridProps) {
    const { data, isLoading, error, mutate } = useSWR(collectionId, fetcher);
    const [state, dispatch] = useReducer(reducer, {
        items: [],
        filters: ["collections", "images", "videos"],
        query: "",
        sort: {
            field: "name",
            asc: true
        }
    });

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

    const applyFilters = (items: CollectionGridItem[]) => {
        let filtered = [];
        if (state.filters.includes("collections")) {
            const collections = items.filter(
                ({ type }) => type === "collection"
            );
            filtered.push(...collections);
        }
        if (state.filters.includes("images")) {
            const images = items.filter(({ type }) => type === "image");
            filtered.push(...images);
        }
        if (state.filters.includes("videos")) {
            const videos = items.filter(({ type }) => type === "video");
            filtered.push(...videos);
        }
        if (state.query) {
            filtered = filtered.filter(
                (item) =>
                    item.name.includes(state.query) ||
                    item.tags?.some(
                        (tag) => tag.localeCompare(state.query) === 0
                    )
            );
        }
        return filtered;
    };

    const sort = (items: CollectionGridItem[]) => {
        const key = state.sort.field === "name" ? "name" : "createdAt";
        return items.sort(caseInsensitiveSorter(key, state.sort.asc));
    };

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar
                isLoading={isLoading}
                actionDispatcher={dispatch}
                collectionId={collectionId}
            />
            <PhotoProvider
                toolbarRender={({ index }) =>
                    state.items && <span>{state.items[index].name}</span>
                }>
                {isLoading && (
                    <Flex
                        alignItems="center"
                        justifyContent="center"
                        w="100%"
                        gap={3}
                        py={5}>
                        <Spinner size="sm" />
                        <span>Loading...</span>
                    </Flex>
                )}
                <SimpleGrid columns={[3, 3, 3, 4]} spacing={[1, 1, 1, 2]}>
                    {sort(applyFilters(state.items)).map((item) => (
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
            </PhotoProvider>
        </Flex>
    );
}

async function fetcher(collectionId: string): Promise<CollectionGridItem[]> {
    if (collectionId === "root") {
        const res = await fetch("/api/collections");
        const data = await res.json();
        const { collections } = data as { collections: CollectionDto[] };
        return collections.map((collection) => ({
            ...collection,
            type: "collection"
        }));
    }
    const res = await fetch(`/api/collections/${collectionId}/files`);
    const data = await res.json();
    const { files } = data as { files: CollectionFileDto[] };
    return files.map((file) => ({
        ...file,
        type: file.mimeType.includes("image") ? "image" : "video"
    }));
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
            state.filters = action.filters;
            state.query = action.query || "";
            break;
        }
        case "SEARCH_START": {
            //TODO
            break;
        }
        case "SEARCH_SUCCESS": {
            //TODO
            break;
        }
        default:
            return state;
    }
    return { ...state };
}

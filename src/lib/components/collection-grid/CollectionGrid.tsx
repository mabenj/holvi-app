import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { Flex, SimpleGrid, Spinner } from "@chakra-ui/react";
import { PhotoProvider } from "react-photo-view";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

// TODO: look into jotai for state management

interface CollectionGridProps {
    rootCollectionId?: string;
}

export default function CollectionGrid({
    rootCollectionId
}: CollectionGridProps) {
    return (
        <CollectionGridProvider rootCollectionId={rootCollectionId}>
            <Flex direction="column" gap={5}>
                <CollectionGridActionBar />
                <Grid />
            </Flex>
        </CollectionGridProvider>
    );
}

const Grid = () => {
    const { gridItems, isLoading, rootCollectionId } = useCollectionGrid();

    return (
        <PhotoProvider
            toolbarRender={({ index }) => <span>{gridItems[index].name}</span>}>
            {isLoading && (
                <Flex
                    alignItems="center"
                    justifyContent="center"
                    w="100%"
                    gap={3}>
                    <Spinner size="sm" />
                    <span>Loading...</span>
                </Flex>
            )}
            <SimpleGrid columns={[3, 3, 3, 4]} spacing={[1, 1, 1, 2]}>
                {gridItems.map((item) => (
                    <CollectionGridCard
                        key={item.id}
                        item={item}
                        collectionId={rootCollectionId}
                    />
                ))}
            </SimpleGrid>
        </PhotoProvider>
    );
};

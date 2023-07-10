import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { Flex, SimpleGrid, Spinner } from "@chakra-ui/react";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

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
    const { gridItems, isLoading } = useCollectionGrid();

    return (
        <SimpleGrid columns={[3, 3, 3, 4]} spacing={[1, 1, 1, 3, 4]}>
            {isLoading && (
                <Flex alignItems="center" w="100%" gap={3}>
                    <Spinner />
                    <span>Loading...</span>
                </Flex>
            )}
            {gridItems.map((item) => (
                <CollectionGridCard key={item.id} item={item} />
            ))}
        </SimpleGrid>
    );
};

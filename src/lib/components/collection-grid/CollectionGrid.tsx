import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { Flex, SimpleGrid } from "@chakra-ui/react";
import PhotoViewer from "../photo-viewer/PhotoViewer";
import IfNotLoading from "../ui/IfNotLoading";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

interface CollectionGridProps {
    collectionId: string;
}

export default function CollectionGrid({ collectionId }: CollectionGridProps) {
    return (
        <CollectionGridProvider collectionId={collectionId}>
            <Grid />
        </CollectionGridProvider>
    );
}

const Grid = () => {
    const { isLoading, collectionId, items } = useCollectionGrid();

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar collectionId={collectionId} />
            <IfNotLoading isLoading={isLoading}>
                <SimpleGrid columns={[3, 3, 4, 6]} spacing={[1, 1, 1, 2]}>
                    {items.map((item) => (
                        <CollectionGridCard key={item.id} item={item} />
                    ))}
                </SimpleGrid>
                <PhotoViewer items={items} />
            </IfNotLoading>
        </Flex>
    );
};

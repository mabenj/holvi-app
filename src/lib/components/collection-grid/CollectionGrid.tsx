import { Flex, SimpleGrid, Skeleton } from "@chakra-ui/react";
import { useCollections } from "../../context/CollectionsContext";
import CollectionCard from "./CollectionCard";
import CollectionGridActionBar from "./CollectionGridActionBar";

interface CollectionGridProps {
    rootCollectionId?: number;
}

export default function CollectionGrid({
    rootCollectionId
}: CollectionGridProps) {
    const { collections, isLoading } = useCollections();

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar rootCollectionId={rootCollectionId} />
            <SimpleGrid minChildWidth="15rem" spacingX={4} spacingY={8}>
                {isLoading &&
                    Array.from({ length: 10 }).map((_, i) => (
                        <Flex
                            key={i}
                            direction="column"
                            alignItems="center"
                            gap={1}>
                            <Skeleton h="10rem" w="100%" rounded="md" />
                            <Skeleton h="1rem" w="9rem" />
                        </Flex>
                    ))}
                {collections.map((collection) => (
                    <CollectionCard
                        key={collection.id}
                        collection={collection}
                    />
                ))}
                {/* {files.map(file => <CollectionCard key={file.id} file={file}/>)} */}
            </SimpleGrid>
        </Flex>
    );
}

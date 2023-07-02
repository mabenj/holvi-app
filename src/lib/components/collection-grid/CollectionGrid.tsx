import { Flex, SimpleGrid } from "@chakra-ui/react";
import { useCollections } from "../../context/CollectionsContext";
import CollectionCard from "./CollectionCard";
import CollectionGridActionBar from "./CollectionGridActionBar";

interface CollectionGridProps {
    rootCollectionId?: number;
}

export default function CollectionGrid({
    rootCollectionId
}: CollectionGridProps) {
    const { collections, setCollections } = useCollections();

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar rootCollectionId={rootCollectionId} />
            <SimpleGrid minChildWidth="15rem" spacingX={4} spacingY={8}>
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

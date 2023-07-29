import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { Box, Flex, Heading, SimpleGrid } from "@chakra-ui/react";
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
            <GridWithActionBar />
        </CollectionGridProvider>
    );
}

const GridWithActionBar = () => {
    const {
        isLoading,
        collectionId,
        items: { collections, files }
    } = useCollectionGrid();

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar collectionId={collectionId} />
            <IfNotLoading isLoading={isLoading}>
                <ResponsiveGrid
                    items={collections}
                    title="Collections"
                    showTitle={files.length > 0}
                />
                <ResponsiveGrid
                    items={files}
                    title="Files"
                    showTitle={collections.length > 0}
                />
                {collections.length === 0 && files.length === 0 && (
                    <Box color="gray.500" p={4}>
                        No collections or files
                    </Box>
                )}

                <PhotoViewer items={files} />
            </IfNotLoading>
        </Flex>
    );
};

const ResponsiveGrid = ({
    items,
    title,
    showTitle = false
}: {
    items: CollectionGridItem[];
    title: string;
    showTitle?: boolean;
}) => {
    if (items.length === 0) {
        return <></>;
    }
    return (
        <>
            {showTitle && (
                <Heading size="md" px={3}>
                    {title}
                </Heading>
            )}

            <SimpleGrid columns={[3, 3, 4, 6]} spacing={[1, 1, 1, 2]}>
                {items.map((item) => (
                    <CollectionGridCard key={item.id} item={item} />
                ))}
            </SimpleGrid>
        </>
    );
};

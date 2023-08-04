import {
    CollectionGridProvider,
    useCollectionGrid
} from "@/lib/context/CollectionGridContext";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { Box, Flex, Heading, SimpleGrid } from "@chakra-ui/react";
import LightboxGallery from "../lightbox-gallery/LightboxGallery";
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
        collectionId,
        items: { collections, files },
        flags: { isLoading }
    } = useCollectionGrid();

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar collectionId={collectionId} />
            <ResponsiveGrid
                items={collections}
                title="Collections"
                showTitle={files.length > 0}
                isLoading={isLoading}
            />
            <ResponsiveGrid
                items={files}
                title="Files"
                showTitle={collections.length > 0}
                isLoading={isLoading}
            />
            {!isLoading && collections.length === 0 && files.length === 0 && (
                <Box color="gray.500" p={4}>
                    No collections or files
                </Box>
            )}
        </Flex>
    );
};

const ResponsiveGrid = ({
    items,
    title,
    showTitle = false,
    isLoading
}: {
    items: CollectionGridItem[];
    title: string;
    showTitle?: boolean;
    isLoading: boolean;
}) => {
    if (!isLoading && items.length === 0) {
        return null;
    }

    return (
        <>
            {showTitle && (
                <Heading size="md" px={3}>
                    {title}
                </Heading>
            )}
            <SimpleGrid columns={[3, 3, 4, 6, 8, 9]} spacing={[0.5, 0.5, 1, 1]}>
                {isLoading ? (
                    Array.from({ length: 20 }).map((_, i) => (
                        <CollectionGridCard key={i} isLoading={isLoading} />
                    ))
                ) : (
                    <LightboxGallery items={items} />
                )}
            </SimpleGrid>
        </>
    );
};

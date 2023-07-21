import { useCollectionGrid } from "@/lib/hooks/useCollectionGrid";
import { Flex, SimpleGrid } from "@chakra-ui/react";
import PhotoViewer from "../photo-viewer/PhotoViewer";
import IfNotLoading from "../ui/IfNotLoading";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionGridCard from "./CollectionGridCard";

interface CollectionGridProps {
    collectionId: string;
}

export default function CollectionGrid({ collectionId }: CollectionGridProps) {
    const { isLoading, items, filters, sort, query, isFileOnly, actions } =
        useCollectionGrid(collectionId);

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar
                collectionId={collectionId}
                isLoading={isLoading}
                filters={filters}
                onFilter={actions.filter}
                sort={sort}
                onSort={actions.sort}
                searchQuery={query}
                onSearch={actions.search}
                onUpload={actions.upload}
                onCreated={actions.add}
                isFileOnly={isFileOnly}
                toggleIsFileOnly={actions.toggleIsFileOnly}
            />
            <IfNotLoading isLoading={isLoading}>
                <SimpleGrid columns={[3, 3, 3, 4]} spacing={[1, 1, 1, 2]}>
                    {items.map((item) => (
                        <CollectionGridCard
                            key={item.id}
                            onDeleted={actions.delete}
                            onUpdated={actions.update}
                            item={item}
                        />
                    ))}
                </SimpleGrid>
                <PhotoViewer items={items} />
            </IfNotLoading>
        </Flex>
    );
}

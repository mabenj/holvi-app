import { caseInsensitiveSorter } from "@/lib/common/utilities";
import CreateCollectionBtn from "@/lib/components/CreateCollectionBtn";
import { Collection } from "@/lib/interfaces/collection";
import { Flex } from "@chakra-ui/react";
import { CollectionsProvider } from "../context/CollectionsContext";
import CollectionGrid from "./collection-grid/CollectionGrid";

interface FrontPageCollectionsProps {
    initialCollections: Collection[];
}

export default function FrontPageCollections({
    initialCollections
}: FrontPageCollectionsProps) {
    return (
        <CollectionsProvider
            initialCollections={initialCollections.sort(
                caseInsensitiveSorter("name")
            )}>
            <Flex direction="column" gap={10}>
                <CollectionGrid />
                <CreateCollectionBtn />
            </Flex>
        </CollectionsProvider>
    );
}

import { caseInsensitiveSorter } from "@/lib/common/utilities";
import CreateCollectionBtnModal from "@/lib/components/CreateCollectionBtnModal";
import { Collection } from "@/lib/interfaces/collection";
import { Flex } from "@chakra-ui/react";
import { CollectionsProvider } from "../context/CollectionsContext";
import CollectionGrid from "./CollectionGrid";

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
                <CreateCollectionBtnModal />
            </Flex>
        </CollectionsProvider>
    );
}

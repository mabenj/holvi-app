import { Collection } from "@/lib/interfaces/collection";
import { AddIcon } from "@chakra-ui/icons";
import { Button, useDisclosure, useToast } from "@chakra-ui/react";
import { useCollections } from "../context/CollectionsContext";
import CollectionModal from "./CollectionModal";

export default function CreateCollectionBtn() {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button onClick={onOpen} leftIcon={<AddIcon />}>
                Create Collection
            </Button>

            <CollectionModal
                isOpen={isOpen}
                onClose={onClose}
                mode="create"
            />
        </>
    );
}

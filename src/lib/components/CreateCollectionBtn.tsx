import { AddIcon } from "@chakra-ui/icons";
import { Button, useDisclosure } from "@chakra-ui/react";
import CollectionModal from "./CollectionModal";

export default function CreateCollectionBtn() {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <>
            <Button onClick={onOpen} leftIcon={<AddIcon />}>
                Create Collection
            </Button>

            <CollectionModal isOpen={isOpen} onClose={onClose} mode="create" />
        </>
    );
}

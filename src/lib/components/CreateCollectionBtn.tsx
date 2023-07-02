import { Collection } from "@/lib/interfaces/collection";
import { AddIcon } from "@chakra-ui/icons";
import { Button, useDisclosure, useToast } from "@chakra-ui/react";
import { useCollections } from "../context/CollectionsContext";
import CollectionModal from "./CollectionModal";

export default function CreateCollectionBtn() {
    const [_, setCollections] = useCollections();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();

    const handleSaved = (collection: Collection) => {
        toast({
            description: "Collection created",
            status: "success"
        });
        onClose();

        setCollections((prev) => [...prev, collection]);
    };

    const handleError = (errorMsg?: string) => {
        if (!errorMsg) {
            return;
        }
        toast({
            description: `Could not create collection: ${errorMsg}`,
            status: "error"
        });
    };

    return (
        <>
            <Button onClick={onOpen} leftIcon={<AddIcon />}>
                Create Collection
            </Button>

            <CollectionModal
                isOpen={isOpen}
                onClose={onClose}
                onSaved={handleSaved}
                onError={handleError}
                mode="create"
            />
        </>
    );
}

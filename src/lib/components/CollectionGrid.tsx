import { useDeleteCollection } from "@/lib/hooks/useDeleteCollection";
import { Collection } from "@/lib/interfaces/collection";
import { Link } from "@chakra-ui/next-js";
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Box,
    Button,
    Flex,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    SimpleGrid,
    Spinner,
    useDisclosure,
    useToast
} from "@chakra-ui/react";
import { mdiDotsVertical } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useCollections } from "../context/CollectionsContext";
import CollectionGridActionBar from "./CollectionGridActionBar";
import CollectionModal from "./CollectionModal";

interface CollectionGridProps {
    rootCollectionId?: number;
}

export default function CollectionGrid({
    rootCollectionId
}: CollectionGridProps) {
    const [collections, setCollections] = useCollections();

    const collectionDeleted = (id: number) => {
        setCollections((prev) => prev.filter((c) => c.id !== id));
    };

    const collectionEdited = (collection: Collection) => {
        setCollections((prev) =>
            prev.map((c) => (c.id === collection.id ? collection : c))
        );
    };

    return (
        <Flex direction="column" gap={5}>
            <CollectionGridActionBar rootCollectionId={rootCollectionId} />
            <SimpleGrid minChildWidth="15rem" spacingX={4} spacingY={8}>
                {collections.map((collection) => (
                    <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onCollectionDeleted={collectionDeleted}
                        onCollectionEdited={collectionEdited}
                    />
                ))}
                {/* {files.map(file => <CollectionCard key={file.id} file={file}/>)} */}
            </SimpleGrid>
        </Flex>
    );
}

interface CollectionCardProps {
    collection: Collection;
    onCollectionDeleted: (id: number) => void;
    onCollectionEdited: (collection: Collection) => void;
}

const CollectionCard = ({
    collection,
    onCollectionDeleted,
    onCollectionEdited
}: CollectionCardProps) => {
    const [isHovering, setIsHovering] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { deleteCollection, isDeleting } = useDeleteCollection();
    const {
        isOpen: isModalOpen,
        onOpen: onModalOpen,
        onClose: onModalClose
    } = useDisclosure();
    const {
        isOpen: isAlertOpen,
        onOpen: onAlertOpen,
        onClose: onAlertClose
    } = useDisclosure();
    const cancelDeleteRef = useRef(null);
    const toast = useToast();

    const handleDelete = () => {
        deleteCollection(collection.id)
            .then(() => {
                onCollectionDeleted(collection.id);
                toast({
                    description: "Collection deleted",
                    status: "success"
                });
            })
            .catch((error) =>
                toast({
                    description: error,
                    status: "error"
                })
            );
    };

    const handleEditSaved = (edited: Collection) => {
        onCollectionEdited(edited);
        toast({
            description: "Collection saved",
            status: "success"
        });
    };

    const handleEditError = (errorMsg?: string) => {
        if (!errorMsg) {
            return;
        }
        toast({
            description: errorMsg,
            status: "error"
        });
    };

    return (
        <>
            <Flex direction="column" alignItems="center" gap={2}>
                <Box
                    w="100%"
                    h="10rem"
                    position="relative"
                    cursor="pointer"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}>
                    <Image
                        src={`https://picsum.photos/seed/${collection.name}/600/400`}
                        alt="placeholder"
                        fill
                        style={{
                            objectFit: "cover",
                            borderRadius: "5px",
                            filter:
                                isHovering || isMenuOpen
                                    ? "brightness(40%)"
                                    : ""
                        }}
                    />
                    {(isHovering || isMenuOpen) && (
                        <Menu
                            onOpen={() => setIsMenuOpen(true)}
                            onClose={() => setIsMenuOpen(false)}>
                            <MenuButton
                                as={IconButton}
                                aria-label="Edit"
                                icon={<Icon path={mdiDotsVertical} size={1} />}
                                variant="ghost"
                                position="absolute"
                                right="0.5rem"
                                top="0.5rem"
                            />

                            <MenuList>
                                <MenuItem onClick={onModalOpen}>
                                    Edit collection
                                </MenuItem>
                                <MenuItem onClick={onAlertOpen}>
                                    Delete collection
                                </MenuItem>
                            </MenuList>
                        </Menu>
                    )}
                    {isDeleting && (
                        <Spinner position="absolute" top="50%" left="50%" />
                    )}
                </Box>
                <Link
                    href={`/collections/${collection.id}`}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}>
                    {collection.name}
                </Link>
            </Flex>
            <CollectionModal
                isOpen={isModalOpen}
                onClose={onModalClose}
                mode="edit"
                onError={handleEditError}
                onSaved={handleEditSaved}
                initialCollection={collection}
            />
            <AlertDialog
                isOpen={isAlertOpen}
                leastDestructiveRef={cancelDeleteRef}
                onClose={onAlertClose}
                isCentered>
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader fontSize="lg" fontWeight="bold">
                            Delete collection
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            Are you sure? You cannot undo this afterwards.
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <Button
                                ref={cancelDeleteRef}
                                onClick={onAlertClose}>
                                Cancel
                            </Button>
                            <Button
                                colorScheme="red"
                                onClick={handleDelete}
                                ml={3}>
                                Delete
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </>
    );
};

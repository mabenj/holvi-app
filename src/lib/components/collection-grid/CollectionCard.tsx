import { useDeleteCollection } from "@/lib/hooks/useDeleteCollection";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
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
    Spinner,
    useDisclosure,
    useToast
} from "@chakra-ui/react";
import { mdiDotsVertical } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import CollectionModal from "../CollectionModal";

interface CollectionCardProps {
    collection: CollectionDto;
}

export default function CollectionCard({ collection }: CollectionCardProps) {
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
    const router = useRouter();
    const toast = useToast();

    const handleDelete = () => {
        deleteCollection(collection.id)
            .then(() => {
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
                        onClick={() =>
                            router.push(`/collections/${collection.id}`)
                        }
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
}

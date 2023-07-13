import { collectionsToGridItems } from "@/lib/common/utilities";
import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { useDeleteCollection } from "@/lib/hooks/useDeleteCollection";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
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
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PhotoView } from "react-photo-view";
import CollectionModal from "../CollectionModal";

export default function CollectionGridCard({
    item
}: {
    item: CollectionGridItem;
}) {
    const { setGridItems } = useCollectionGrid();
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

    const isCollection = item.type === "collection";
    const isVideo = item.type === "video";

    const handleClick = () => {
        switch (item.type) {
            case "collection":
                router.push(`/collections/${item.id}`);
                break;
            case "image":
                // TODO: open image (react-photo-view)
                break;
            case "video":
                //TODO view video
                break;
            default:
                toast({
                    description: "Unsupported file type",
                    status: "error"
                });
        }
    };

    const handleCollectionSaved = (collection: CollectionDto) => {
        setGridItems((prev) =>
            prev.map((c) =>
                c.id === collection.id
                    ? collectionsToGridItems([collection])[0]
                    : c
            )
        );
    };

    const handleDelete = async () => {
        try {
            if (isCollection) {
                await deleteCollection(item.id);
            } else {
                //TODO
                throw new Error("Not implemented");
            }
            setGridItems((prev) => prev.filter(({ id }) => id !== item.id));
            toast({
                description: `${
                    isCollection ? "Collection" : isVideo ? "Video" : "Image"
                } deleted`,
                status: "success"
            });
        } catch (error) {
            toast({
                description: `Error deleting ${
                    isCollection ? "collection" : isVideo ? "video" : "image"
                }`,
                status: "error"
            });
        } finally {
            onAlertClose();
        }
    };

    return (
        <>
            <Flex direction="column" alignItems="center" gap={2}>
                <Box
                    w="100%"
                    h={["8rem", "8rem", "8rem", "14rem"]}
                    position="relative"
                    cursor="pointer"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    onClick={handleClick}>
                    {isCollection ? (
                        <Flex
                            alignItems="center"
                            justifyContent="center"
                            w="100%"
                            h="100%">
                            <Box w="80%" h="80%" rounded="md" bg="blue.500" />
                        </Flex>
                    ) : (
                        <PhotoView src={item.src!}>
                            <Image
                                src={item.thumbnailSrc!}
                                alt={item.name}
                                fill
                                style={{
                                    objectFit: "cover",
                                    filter:
                                        !isCollection &&
                                        (isHovering || isMenuOpen)
                                            ? "brightness(60%)"
                                            : ""
                                }}
                            />
                        </PhotoView>
                    )}

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
                                    Edit {isCollection ? "collection" : "file"}
                                </MenuItem>
                                <MenuItem onClick={onAlertOpen}>
                                    Delete{" "}
                                    {isCollection ? "collection" : "file"}
                                </MenuItem>
                            </MenuList>
                        </Menu>
                    )}
                    {(isHovering || isMenuOpen) && (
                        <Box
                            position="absolute"
                            bottom={0}
                            p={2}
                            width="100%"
                            whiteSpace="nowrap"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            cursor="text"
                            title={item.name}>
                            {item.name}
                        </Box>
                    )}
                    {isDeleting && (
                        <Spinner position="absolute" top="50%" left="50%" />
                    )}
                </Box>
            </Flex>
            {isCollection && (
                <CollectionModal
                    isOpen={isModalOpen}
                    onClose={onModalClose}
                    onSave={handleCollectionSaved}
                    mode="edit"
                    initialCollection={{
                        id: item.id,
                        name: item.name,
                        tags: item.tags
                    }}
                />
            )}

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

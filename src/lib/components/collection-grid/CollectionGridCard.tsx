import { useHttp } from "@/lib/hooks/useHttp";
import { CollectionDto } from "@/lib/interfaces/collection-dto";
import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
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
import {
    mdiCamera,
    mdiDelete,
    mdiDotsVertical,
    mdiImageOutline,
    mdiPlayCircle,
    mdiSquareEditOutline,
    mdiVideo
} from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import CollectionFileModal from "../modals/CollectionFileModal";
import CollectionModal from "../modals/CollectionModal";
import { Photo } from "../photo-viewer/PhotoViewer";

interface CollectionGridCardProps {
    item: CollectionGridItem;
    onDeleted: (id: string) => void;
    onUpdated: (item: CollectionGridItem) => void;
}

export default function CollectionGridCard({
    item,
    onDeleted,
    onUpdated
}: CollectionGridCardProps) {
    const [isHovering, setIsHovering] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const {
        isOpen: isCollectionModalOpen,
        onOpen: onCollectionModalOpen,
        onClose: onCollectionModalClose
    } = useDisclosure();
    const {
        isOpen: isFileModalOpen,
        onOpen: onFileModalOpen,
        onClose: onFileModalClose
    } = useDisclosure();
    const {
        isOpen: isAlertOpen,
        onOpen: onAlertOpen,
        onClose: onAlertClose
    } = useDisclosure();
    const http = useHttp();
    const cancelDeleteRef = useRef(null);
    const toast = useToast();

    const isCollection = item.type === "collection";
    const isImage = item.type === "image";
    const isVideo = item.type === "video";

    const handleCollectionSaved = (collection: CollectionDto) => {
        onUpdated({ ...collection, type: "collection" });
    };

    const handleFileSaved = (file: CollectionFileDto) => {
        onUpdated({
            ...file,
            type: file.mimeType.includes("image") ? "image" : "video"
        });
    };

    const handleDelete = async () => {
        const { error } = await http.delete(
            "collectionId" in item
                ? `/api/collections/${item.collectionId}/files/${item.id}`
                : `/api/collections/${item.id}`
        );
        if (error) {
            toast({
                description: `Error deleting ${
                    isCollection ? "collection" : "file"
                }`,
                status: "error"
            });
            return;
        }
        onDeleted(item.id);
        onAlertClose();
        toast({
            description: `${isCollection ? "Collection" : "File"} deleted`,
            status: "info"
        });
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
                    onMouseLeave={() => setIsHovering(false)}>
                    {isCollection && (
                        <CollectionThumbnail
                            item={item as CollectionDto}
                            isHovering={isHovering}
                        />
                    )}
                    {isImage && (
                        <ImageThumbnail item={item as CollectionFileDto} />
                    )}
                    {isVideo && (
                        <VideoThumbnail item={item as CollectionFileDto} />
                    )}

                    {(isHovering || isMenuOpen) && (
                        <Menu
                            onOpen={() => setIsMenuOpen(true)}
                            onClose={() => setIsMenuOpen(false)}>
                            <MenuButton
                                as={IconButton}
                                aria-label="Edit"
                                color="white"
                                backgroundColor="whiteAlpha.200"
                                icon={<Icon path={mdiDotsVertical} size={1} />}
                                variant="ghost"
                                position="absolute"
                                right="0.5rem"
                                top="0.5rem"
                                style={{
                                    filter: "drop-shadow(0 0 2px black)"
                                }}
                                _hover={{
                                    backgroundColor: "whiteAlpha.400"
                                }}
                                _active={{
                                    backgroundColor: "whiteAlpha.400"
                                }}
                            />

                            <MenuList>
                                <MenuItem
                                    icon={
                                        <Icon
                                            path={mdiSquareEditOutline}
                                            size={0.7}
                                        />
                                    }
                                    onClick={
                                        isCollection
                                            ? onCollectionModalOpen
                                            : onFileModalOpen
                                    }>
                                    Edit {isCollection ? "collection" : "file"}
                                </MenuItem>
                                <MenuItem
                                    icon={<Icon path={mdiDelete} size={0.7} />}
                                    onClick={onAlertOpen}>
                                    Delete{" "}
                                    {isCollection ? "collection" : "file"}
                                </MenuItem>
                            </MenuList>
                        </Menu>
                    )}
                    {http.isLoading && (
                        <Spinner
                            position="absolute"
                            top="50%"
                            left="50%"
                            color="whiteAlpha.800"
                        />
                    )}
                </Box>
            </Flex>

            {isCollection && (
                <CollectionModal
                    isOpen={isCollectionModalOpen}
                    onClose={onCollectionModalClose}
                    onSave={handleCollectionSaved}
                    mode="edit"
                    initialCollection={{
                        id: item.id,
                        name: item.name,
                        tags: item.tags
                    }}
                />
            )}

            {(isImage || isVideo) && (
                <CollectionFileModal
                    isOpen={isFileModalOpen}
                    onClose={onFileModalClose}
                    onSave={handleFileSaved}
                    initialFile={{
                        collectionId: (item as CollectionFileDto).collectionId,
                        id: item.id,
                        name: item.name,
                        tags: item.tags || []
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
                            Delete {isCollection ? "collection" : "file"}
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
                                isLoading={http.isLoading}
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

const CollectionThumbnail = ({
    item,
    isHovering
}: {
    item: CollectionDto;
    isHovering: boolean;
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeThumbnailIndex, setActiveThumbnailIndex] = useState(0);
    const intervalRef = useRef(0);
    const router = useRouter();

    const INTERVAL_MS = 500;

    useEffect(() => {
        if (isHovering && !isLoading) {
            intervalRef.current = window.setInterval(() => {
                setActiveThumbnailIndex((prev) =>
                    prev + 1 >= item.thumbnails.length ? 0 : prev + 1
                );
            }, INTERVAL_MS);
        } else {
            setActiveThumbnailIndex(0);
            window.clearInterval(intervalRef.current);
        }
    }, [isHovering, isLoading, item.thumbnails.length]);

    const handleClick = async () => {
        setIsLoading(true);
        await router.push(`/collections/${item.id}`);
        setIsLoading(false);
    };

    return (
        <>
            <Flex
                justifyContent="center"
                alignItems="center"
                w="100%"
                h="100%"
                onClick={handleClick}>
                {item.thumbnails.length > 1 && (
                    <Box w="100%" h="100%" position="relative">
                        <Image
                            src={item.thumbnails[activeThumbnailIndex]}
                            alt={item.name}
                            fill
                            style={{
                                position: "absolute",
                                objectFit: "cover"
                            }}
                        />
                    </Box>
                )}
                {item.thumbnails.length === 0 && (
                    <Icon path={mdiImageOutline} size={4} />
                )}
                <Flex
                    fontSize={["xs", "xs", "sm", "md"]}
                    w="100%"
                    h="100%"
                    justifyContent="space-between"
                    alignItems="flex-end"
                    gap={2}
                    position="absolute"
                    pointerEvents="none"
                    py={1}
                    px={2}
                    bottom={0}
                    left={0}
                    color="#fff"
                    backgroundImage={`linear-gradient(
                        rgba(0, 0, 0, 0.0) 80%,
                        rgba(0, 0, 0, 0.9) 100%
                    )`}
                    style={{
                        textShadow: `-1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        -1px 1px 0 rgba(0, 0, 0, 0.4), 
                                        1px 1px 0 rgba(0, 0, 0, 0.4)`
                    }}
                    opacity={isHovering ? 0 : 0.9}
                    transition="all 0.3s">
                    <Box
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis">
                        {item.name}
                    </Box>
                    <Flex alignItems="center" gap={2}>
                        {item.imageCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiCamera}
                                    size={0.7}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.imageCount}</span>
                            </Flex>
                        )}
                        {item.videoCount > 0 && (
                            <Flex alignItems="center" gap={1}>
                                <Icon
                                    path={mdiVideo}
                                    size={0.7}
                                    style={{
                                        filter: "drop-shadow(0 0 2px black)"
                                    }}
                                />
                                <span>{item.videoCount}</span>
                            </Flex>
                        )}
                    </Flex>
                </Flex>
            </Flex>
            {isLoading && (
                <Spinner
                    position="absolute"
                    top="50%"
                    left="50%"
                    color="whiteAlpha.800"
                />
            )}
        </>
    );
};

const ImageThumbnail = ({ item }: { item: CollectionFileDto }) => {
    return (
        <Photo id={item.id}>
            <Box maxW="100%" maxH="100%" overflow="hidden">
                <Image
                    src={item.thumbnailSrc!}
                    alt={item.name}
                    fill
                    style={{
                        objectFit: "cover"
                    }}
                />
            </Box>
        </Photo>
    );
};

const VideoThumbnail = ({ item }: { item: CollectionFileDto }) => {
    return (
        <Photo id={item.id}>
            <Image
                src={item.thumbnailSrc!}
                alt={item.name}
                fill
                style={{
                    objectFit: "cover"
                }}
            />
            <Box
                position="absolute"
                pointerEvents="none"
                p={1}
                color="whiteAlpha.800">
                <Icon
                    path={mdiPlayCircle}
                    size={1}
                    style={{
                        filter: "drop-shadow(0 0 2px black)"
                    }}
                />
            </Box>
        </Photo>
    );
};

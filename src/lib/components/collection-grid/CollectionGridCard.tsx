import { collectionsToGridItems } from "@/lib/common/utilities";
import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { useDeleteCollection } from "@/lib/hooks/useDeleteCollection";
import { useDeleteFile } from "@/lib/hooks/useDeleteFile";
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
import { mdiDotsVertical, mdiPlayCircle } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PhotoView } from "react-photo-view";
import CollectionModal from "../CollectionModal";

export default function CollectionGridCard({
    item,
    collectionId
}: {
    item: CollectionGridItem;
    collectionId: string;
}) {
    const { setGridItems } = useCollectionGrid();
    const [isHovering, setIsHovering] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { deleteCollection, isDeleting: isDeletingCollection } =
        useDeleteCollection();
    const { deleteFile, isDeleting: isDeletingFile } =
        useDeleteFile(collectionId);
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

    const isCollection = item.type === "collection";
    const isImage = item.type === "image";
    const isVideo = item.type === "video";
    const isDeleting = isDeletingCollection || isDeletingFile;

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
                await deleteFile(item.id);
            }
            setGridItems((prev) => prev.filter(({ id }) => id !== item.id));
            toast({
                description: `${isCollection ? "Collection" : "File"} deleted`,
                status: "success"
            });
        } catch (error) {
            toast({
                description: `Error deleting ${
                    isCollection ? "collection" : "file"
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
                    onMouseLeave={() => setIsHovering(false)}>
                    {isCollection && <CollectionThumbnail item={item} />}
                    {isImage && (
                        <ImageThumbnail
                            item={item}
                            isDim={isHovering || isMenuOpen}
                        />
                    )}
                    {isVideo && (
                        <VideoThumbnail
                            item={item}
                            isDim={isHovering || isMenuOpen}
                        />
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
                    {!isCollection && (isHovering || isMenuOpen) && (
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

const CollectionThumbnail = ({ item }: { item: CollectionGridItem }) => {
    const router = useRouter();

    return (
        <Flex
            direction="column"
            alignItems="center"
            justifyContent="center"
            w="100%"
            h="100%"
            onClick={() => router.push(`/collections/${item.id}`)}>
            <div className="collection-icon" />
            <span>{item.name}</span>
        </Flex>
    );
};

const ImageThumbnail = ({
    item,
    isDim
}: {
    item: CollectionGridItem;
    isDim: boolean;
}) => {
    return (
        <PhotoView src={item.src!}>
            <Image
                src={item.thumbnailSrc!}
                alt={item.name}
                fill
                style={{
                    objectFit: "cover",
                    filter: isDim ? "brightness(60%) blur(1px)" : ""
                }}
            />
        </PhotoView>
    );
};

const VideoThumbnail = ({
    item,
    isDim
}: {
    item: CollectionGridItem;
    isDim: boolean;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // TODO check these:
    // https://github.com/CookPete/react-player
    // https://github.com/sampotts/plyr

    return (
        <>
            <PhotoView
                render={({ attrs, scale }) => {
                    return (
                        <div
                            style={{
                                transform: "translate(-50%, -50%)",
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center"
                            }}>
                            <video
                                {...attrs}
                                ref={videoRef}
                                src={item.src}
                                poster={item.thumbnailSrc}
                                style={{
                                    width: "100%",
                                    height: "90dvh"
                                }}
                                controls
                            />
                        </div>
                    );
                }}>
                <Image
                    src={item.thumbnailSrc!}
                    alt={item.name}
                    fill
                    style={{
                        objectFit: "cover",
                        filter: isDim ? "brightness(60%) blur(1px)" : ""
                    }}
                    onClick={() => {
                        setTimeout(() => videoRef.current?.play(), 1000);
                    }}
                />
            </PhotoView>
            <Box position="absolute" pointerEvents="none" p={1}>
                <Icon path={mdiPlayCircle} size={1} />
            </Box>
        </>
    );
};

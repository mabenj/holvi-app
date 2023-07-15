import { useDeleteCollection } from "@/lib/hooks/useDeleteCollection";
import { useDeleteFile } from "@/lib/hooks/useDeleteFile";
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
    mdiDotsVertical,
    mdiImageMultiple,
    mdiImageOutline,
    mdiPlayCircle
} from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { PhotoView } from "react-photo-view";
import CollectionModal from "../CollectionModal";

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
    const { deleteCollection, isDeleting: isDeletingCollection } =
        useDeleteCollection();
    const { deleteFile, isDeleting: isDeletingFile } = useDeleteFile();
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
        onUpdated({ ...collection, type: "collection" });
    };

    const handleDelete = async () => {
        try {
            if (item.type === "collection") {
                await deleteCollection(item.id);
            } else if ("collectionId" in item) {
                await deleteFile(item.collectionId, item.id);
            }
            onDeleted(item.id);
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
            <Flex
                direction="column"
                alignItems="center"
                gap={2}
                title={item.name}>
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
                                icon={<Icon path={mdiDotsVertical} size={1} />}
                                variant="ghost"
                                position="absolute"
                                right="0.5rem"
                                top="0.5rem"
                                style={{
                                    filter: "drop-shadow(0 0 2px black)"
                                }}
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
                    {isDeleting && (
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

const CollectionThumbnail = ({
    item,
    isHovering
}: {
    item: CollectionDto;
    isHovering: boolean;
}) => {
    const router = useRouter();

    const thumbnails = item.thumbnails || [];
    if (thumbnails.length > 1 && thumbnails.length < 4) {
        for (let i = thumbnails.length; i < 4; i++) {
            thumbnails.push(thumbnails[(i * 20) % thumbnails.length]);
        }
    }

    return (
        <>
            <Flex
                justifyContent="center"
                alignItems="center"
                w="100%"
                h="100%"
                onClick={() => router.push(`/collections/${item.id}`)}>
                {thumbnails.length > 1 && (
                    <figure
                        className="stack-sidegrid">
                        {thumbnails.map((src, i) => (
                            <Image
                                key={i}
                                src={src}
                                alt={item.name}
                                fill
                                style={{
                                    objectFit: "cover"
                                }}
                            />
                        ))}
                    </figure>
                )}
                {thumbnails.length === 1 && (
                    <Box w="100%" h="100%" position="relative">
                        <Image
                            src={thumbnails[0]}
                            alt={item.name}
                            fill
                            style={{
                                position: "absolute",
                                objectFit: "cover"
                            }}
                        />
                    </Box>
                )}
                {thumbnails.length === 0 && (
                    <Icon path={mdiImageOutline} size={4} />
                )}
                <Box
                    position="absolute"
                    pointerEvents="none"
                    p={1}
                    top={0}
                    left={0}
                    color="whiteAlpha.800">
                    <Icon
                        path={mdiImageMultiple}
                        size={1}
                        style={{
                            filter: "drop-shadow(0 0 2px black)"
                        }}
                    />
                </Box>
            </Flex>
            <Flex
                justifyContent="center"
                alignItems="flex-end"
                position="absolute"
                bottom={0}
                width="100%"
                height="100%"
                p={2}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                cursor="text"
                title={item.name}
                color="whiteAlpha.800"
                backgroundImage={`linear-gradient(
                    rgba(0, 0, 0, 0.0) 50%,
                    rgba(0, 0, 0, 0.9) 100%
                )`}
                pointerEvents="none"
                transition="all 0.3s"
                opacity={isHovering ? 0 : 1}>
                <span
                    style={{
                        textShadow: `-1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        1px -1px 0 rgba(0, 0, 0, 0.4), 
                                        -1px 1px 0 rgba(0, 0, 0, 0.4), 
                                        1px 1px 0 rgba(0, 0, 0, 0.4)`
                    }}>
                    {item.name}
                </span>
            </Flex>
        </>
    );
};

const ImageThumbnail = ({ item }: { item: CollectionFileDto }) => {
    return (
        <PhotoView src={item.src!}>
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
        </PhotoView>
    );
};

const VideoThumbnail = ({ item }: { item: CollectionFileDto }) => {
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
                        objectFit: "cover"
                    }}
                    onClick={() => {
                        setTimeout(() => videoRef.current?.play(), 1000);
                    }}
                />
            </PhotoView>
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
        </>
    );
};

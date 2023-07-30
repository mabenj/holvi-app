import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { CollectionDto } from "@/lib/types/collection-dto";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import {
    Box,
    Flex,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    useDisclosure
} from "@chakra-ui/react";
import { mdiDelete, mdiDotsVertical, mdiSquareEditOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useRef, useState } from "react";
import CollectionFileModal from "../modals/CollectionFileModal";
import CollectionModal from "../modals/CollectionModal";
import AreYouSureDialog from "../ui/AreYouSureDialog";
import CollectionCardThumbnail from "./CollectionCardThumbnail";
import ImageCardThumbnail from "./ImageCardThumbnail";
import VideoCardThumbnail from "./VideoCardThumbnail";

interface CollectionGridCardProps {
    item: CollectionGridItem;
}

export default function CollectionGridCard({ item }: CollectionGridCardProps) {
    const {
        actions: { saveCollection, deleteCollection, editFile, deleteFile },
        flags: { isSavingCollection, isDeletingCollection, isSavingFile, isDeletingFile }
    } = useCollectionGrid();

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

    const isCollection = item.type === "collection";
    const isImage = item.type === "image";
    const isVideo = item.type === "video";
    const isDeleting = isDeletingCollection || isDeletingFile;

    const handleDelete = async () => {
        if (isCollection) {
            await deleteCollection(item.id);
        } else {
            await deleteFile(item.id);
        }
        onAlertClose();
    };

    return (
        <>
            <Flex direction="column" alignItems="center" gap={2}>
                <Box
                    w="100%"
                    h={["8rem", "10rem", "11rem", "11em"]}
                    position="relative"
                    cursor="pointer"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}>
                    {isCollection && (
                        <CollectionCardThumbnail
                            item={item as CollectionDto}
                            isHovering={isHovering}
                        />
                    )}
                    {isImage && (
                        <ImageCardThumbnail item={item as CollectionFileDto} />
                    )}
                    {isVideo && (
                        <VideoCardThumbnail item={item as CollectionFileDto} />
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
                </Box>
            </Flex>

            {isCollection && (
                <CollectionModal
                    isOpen={isCollectionModalOpen}
                    onClose={onCollectionModalClose}
                    onSave={saveCollection}
                    isSaving={isSavingCollection}
                    mode="edit"
                    initialCollection={item as CollectionDto}
                />
            )}

            {(isImage || isVideo) && (
                <CollectionFileModal
                    isOpen={isFileModalOpen}
                    onClose={onFileModalClose}
                    onSave={editFile}
                    isSaving={isSavingFile}
                    initialFile={item as CollectionFileDto}
                />
            )}

            <AreYouSureDialog
                confirmLabel="Delete"
                header={`Delete ${isCollection ? "collection" : "file"}`}
                isConfirming={isDeleting}
                isOpen={isAlertOpen}
                onClose={onAlertClose}
                onConfirm={handleDelete}>
                Are you sure? You cannot undo this afterwards.
            </AreYouSureDialog>
        </>
    );
}

import { useCollectionGrid } from "@/lib/context/CollectionGridContext";
import { CollectionDto } from "@/lib/types/collection-dto";
import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import { CollectionGridItem } from "@/lib/types/collection-grid-item";
import { Box, Flex, IconButton, Skeleton } from "@chakra-ui/react";
import {
    mdiCheckboxBlankOutline,
    mdiCheckboxIntermediate,
    mdiCheckboxMarked
} from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import CollectionCardThumbnail from "./CollectionCardThumbnail";
import ImageCardThumbnail from "./ImageCardThumbnail";
import VideoCardThumbnail from "./VideoCardThumbnail";

interface CollectionGridCardProps {
    isLoading?: boolean;
    item?: CollectionGridItem;
    imageRef?: React.MutableRefObject<HTMLImageElement>;
}

export default function CollectionGridCard({
    item,
    isLoading = false,
    imageRef
}: CollectionGridCardProps) {
    const isCollection = item?.type === "collection";
    const isImage = item?.type === "image";
    const isVideo = item?.type === "video";

    return (
        <>
            <Flex direction="column" alignItems="center" gap={2}>
                <Box
                    w="100%"
                    h={["8rem", "10rem", "11rem", "11em"]}
                    position="relative"
                    cursor="pointer">
                    {isLoading && <Skeleton w="100%" h="100%" />}
                    {!isLoading && isCollection && (
                        <CollectionCardThumbnail
                            imageRef={imageRef}
                            item={item as CollectionDto}
                        />
                    )}
                    {!isLoading && isImage && (
                        <ImageCardThumbnail
                            imageRef={imageRef}
                            item={item as CollectionFileDto}
                        />
                    )}
                    {!isLoading && isVideo && (
                        <VideoCardThumbnail
                            imageRef={imageRef}
                            item={item as CollectionFileDto}
                        />
                    )}

                    {item && <SelectCheckbox itemId={item.id} />}
                </Box>
            </Flex>
        </>
    );
}

const SelectCheckbox = ({ itemId }: { itemId: string }) => {
    const [isHovering, setIsHovering] = useState(false);
    const {
        flags: { isSelectModeOn },
        actions: { toggleSelection },
        selection
    } = useCollectionGrid();

    if (!isSelectModeOn) {
        return null;
    }

    const isSelected = !!selection[itemId];
    const iconPath = isSelected
        ? mdiCheckboxMarked
        : isHovering
        ? mdiCheckboxIntermediate
        : mdiCheckboxBlankOutline;

    return (
        <IconButton
            variant="ghost"
            position="absolute"
            top={0}
            icon={
                <Icon
                    path={iconPath}
                    size={1}
                    style={{
                        filter: "drop-shadow(0 0 2px black)"
                    }}
                />
            }
            aria-label="Select item"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => toggleSelection(itemId)}
        />
    );
};

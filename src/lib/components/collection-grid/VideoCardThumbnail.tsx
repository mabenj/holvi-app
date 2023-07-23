import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { Box } from "@chakra-ui/react";
import { mdiPlayCircle } from "@mdi/js";
import Icon from "@mdi/react";
import Image from "next/image";
import { Photo } from "../photo-viewer/PhotoViewer";

export default function VideoCardThumbnail({
    item
}: {
    item: CollectionFileDto;
}) {
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
}

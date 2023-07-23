import { CollectionFileDto } from "@/lib/interfaces/collection-file-dto";
import { Box } from "@chakra-ui/react";
import Image from "next/image";
import { Photo } from "../photo-viewer/PhotoViewer";

export default function ImageCardThumbnail({
    item
}: {
    item: CollectionFileDto;
}) {
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
}

import { CollectionFileDto } from "@/lib/types/collection-file-dto";
import { Box } from "@chakra-ui/react";
import Image from "next/image";
import { useRouter } from "next/router";

export default function ImageCardThumbnail({
    item
}: {
    item: CollectionFileDto;
}) {
    const router = useRouter();

    const handleClick = () => {
        router.push(
            {
                pathname: window.location.pathname,
                query: {
                    photoId: item.id
                }
            },
            undefined,
            { shallow: true }
        );
    };

    return (
        <Box maxW="100%" maxH="100%" overflow="hidden" onClick={handleClick}>
            <Image
                src={item.thumbnailSrc!}
                alt={item.name}
                fill
                style={{
                    objectFit: "cover"
                }}
            />
        </Box>
    );
}

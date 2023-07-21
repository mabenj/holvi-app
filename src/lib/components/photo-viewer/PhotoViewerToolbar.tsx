import { formatDate } from "@/lib/common/utilities";
import { CollectionGridItem } from "@/lib/interfaces/collection-grid-item";
import { Link } from "@chakra-ui/next-js";
import { Box, Flex } from "@chakra-ui/react";
import { mdiMapMarker } from "@mdi/js";
import Icon from "@mdi/react";

export default function PhotoViewerToolbar({
    item
}: {
    item?: CollectionGridItem;
}) {
    if (!item) {
        return <span>Invalid image</span>;
    }

    return (
        <Flex direction="column" alignItems="end" pr={5}>
            <Box fontSize="sm">{item.name}</Box>
            <Flex gap={2} fontSize="xs" textColor="whiteAlpha.600">
                <Box>
                    {item.type === "image" && item.gps && (
                        <Link
                            href={`https://www.google.com/maps/search/?api=1&query=${item.gps.lat},${item.gps.long}`}
                            target="_blank">
                            <Flex alignItems="center" gap={1}>
                                <Icon path={mdiMapMarker} size={0.5} />
                                <span>{item.gps.label || "Google Maps"}</span>
                            </Flex>
                        </Link>
                    )}
                </Box>
                {item.type === "image" && item.gps && <span>|</span>}
                <span>{formatDate(item.timestamp)}</span>
            </Flex>
        </Flex>
    );
}

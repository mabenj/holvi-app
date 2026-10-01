import { Box, Collapsible, Flex, HStack, Tag, Text } from "@chakra-ui/react";
import { mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import { describeCounts } from "./collection-counts";
import LinkifiedText from "./LinkifiedText";

interface CollectionDetailsProps {
    imageCount: number;
    videoCount: number;
    description: string;
    tags: string[];
}

/**
 * How many photos and videos a collection holds, then its description and
 * tags behind an expander. Each part is left out when there is nothing to
 * show, and the whole area when there is nothing at all.
 */
export default function CollectionDetails({
    imageCount,
    videoCount,
    description,
    tags
}: CollectionDetailsProps) {
    const counts = describeCounts({ imageCount, videoCount });
    const expandable = !!description || tags.length > 0;
    if (!counts && !expandable) {
        return null;
    }
    return (
        <Box px="4" pt="2" pb="1">
            {counts && (
                <Text color="fg.muted" fontSize="sm">
                    {counts}
                </Text>
            )}
            {expandable && (
                <Collapsible.Root>
                    <Collapsible.Trigger
                        display="flex"
                        alignItems="center"
                        gap="1"
                        py="2"
                        color="fg.muted"
                        fontSize="sm"
                        fontWeight="medium"
                        cursor="pointer"
                        css={{
                            "&[data-state=open] svg": {
                                transform: "rotate(180deg)"
                            }
                        }}>
                        Details
                        <Icon
                            path={mdiChevronDown}
                            size="18px"
                            style={{ transition: "transform 0.2s" }}
                            aria-hidden
                        />
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                        <Flex direction="column" gap="3" pb="3">
                            {description && (
                                <Text whiteSpace="pre-wrap" fontSize="sm">
                                    <LinkifiedText text={description} />
                                </Text>
                            )}
                            {tags.length > 0 && (
                                <HStack wrap="wrap" gap="1.5">
                                    {tags.map((tag) => (
                                        <Tag.Root
                                            key={tag}
                                            size="md"
                                            variant="subtle">
                                            <Tag.Label>{tag}</Tag.Label>
                                        </Tag.Root>
                                    ))}
                                </HStack>
                            )}
                        </Flex>
                    </Collapsible.Content>
                </Collapsible.Root>
            )}
        </Box>
    );
}

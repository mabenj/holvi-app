import { Collapsible, Flex, HStack, Tag, Text } from "@chakra-ui/react";
import { mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import LinkifiedText from "./LinkifiedText";

interface CollectionDetailsProps {
    description: string;
    tags: string[];
}

/** The description and tags of a collection, behind an expander; nothing when it has neither */
export default function CollectionDetails({
    description,
    tags
}: CollectionDetailsProps) {
    if (!description && tags.length === 0) {
        return null;
    }
    return (
        <Collapsible.Root px="4" py="1">
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
                    "&[data-state=open] svg": { transform: "rotate(180deg)" }
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
                                <Tag.Root key={tag} size="md" variant="subtle">
                                    <Tag.Label>{tag}</Tag.Label>
                                </Tag.Root>
                            ))}
                        </HStack>
                    )}
                </Flex>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}

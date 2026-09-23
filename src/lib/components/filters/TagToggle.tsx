import { Button, Flex, FlexProps, Text } from "@chakra-ui/react";
import { mdiCheck } from "@mdi/js";
import Icon from "@mdi/react";
import type { TagCount } from "../../types/tag-count";

interface TagToggleProps {
    name: string;
    /** How many collections or files have the tag, when known */
    count?: number;
    selected: boolean;
    onToggle: () => void;
}

/** A tag that narrows a filter while it is selected */
export default function TagToggle({
    name,
    count,
    selected,
    onToggle
}: TagToggleProps) {
    return (
        <Button
            size="sm"
            rounded="full"
            flexShrink="0"
            variant={selected ? "solid" : "outline"}
            aria-pressed={selected}
            onClick={onToggle}>
            {selected && <Icon path={mdiCheck} size="16px" aria-hidden />}
            {name}
            {count !== undefined && (
                <Text as="span" opacity="0.7" fontWeight="normal">
                    {count}
                </Text>
            )}
        </Button>
    );
}

/** The tags with `tag` added, or removed if it is there already, ignoring case */
export function toggleTag(tags: string[], tag: string) {
    const lower = tag.toLowerCase();
    return tags.some((t) => t.toLowerCase() === lower)
        ? tags.filter((t) => t.toLowerCase() !== lower)
        : [...tags, tag];
}

/** Whether the tags include `tag`, ignoring case */
export function hasTag(tags: string[], tag: string) {
    const lower = tag.toLowerCase();
    return tags.some((t) => t.toLowerCase() === lower);
}

interface TagTogglesProps extends Omit<FlexProps, "onChange"> {
    /** The tags to offer, most used first */
    tagCounts: TagCount[];
    /** The selected tags */
    value: string[];
    onChange: (tags: string[]) => void;
}

/**
 * A toggle for each tag, with its count. Selected tags that no longer have
 * a count stay first on the list, so they can still be turned off.
 */
export function TagToggles({
    tagCounts,
    value,
    onChange,
    ...flexProps
}: TagTogglesProps) {
    const counted = tagCounts.map((count) => count.name);
    const uncounted = value.filter((tag) => !hasTag(counted, tag));
    return (
        <Flex gap="2" {...flexProps}>
            {uncounted.map((tag) => (
                <TagToggle
                    key={tag}
                    name={tag}
                    selected
                    onToggle={() => onChange(toggleTag(value, tag))}
                />
            ))}
            {tagCounts.map(({ name, count }) => (
                <TagToggle
                    key={name}
                    name={name}
                    count={count}
                    selected={hasTag(value, name)}
                    onToggle={() => onChange(toggleTag(value, name))}
                />
            ))}
        </Flex>
    );
}

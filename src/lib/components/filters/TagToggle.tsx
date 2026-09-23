import { Button, Text } from "@chakra-ui/react";
import { mdiCheck } from "@mdi/js";
import Icon from "@mdi/react";

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

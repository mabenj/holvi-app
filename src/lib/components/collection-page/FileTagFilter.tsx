import { fetchTagCounts, tagCountsUrl } from "@/lib/client/tags";
import { Flex } from "@chakra-ui/react";
import useSWR from "swr";
import TagToggle, { hasTag, toggleTag } from "../filters/TagToggle";

interface FileTagFilterProps {
    collectionId: string;
    /** The selected file tags; files must have all of them */
    value: string[];
    onChange: (tags: string[]) => void;
}

/**
 * The file tags of a collection, most used first with their counts, as a row
 * of toggles that filter its files. Nothing while no file in it has a tag.
 */
export default function FileTagFilter({
    collectionId,
    value,
    onChange
}: FileTagFilterProps) {
    const { data: tagCounts } = useSWR(
        tagCountsUrl("files", collectionId),
        fetchTagCounts,
        { revalidateOnFocus: false }
    );
    const counted = tagCounts ?? [];
    // Selected tags stay on the row even if no file has them any more
    const missing = value.filter(
        (tag) => !hasTag(counted.map((count) => count.name), tag)
    );
    if (counted.length === 0 && missing.length === 0) {
        return null;
    }
    return (
        <Flex
            role="group"
            aria-label="Filter files by tag"
            flex="1"
            minW="0"
            gap="1.5"
            overflowX="auto"
            css={{ scrollbarWidth: "none" }}>
            {missing.map((tag) => (
                <TagToggle
                    key={tag}
                    name={tag}
                    selected
                    onToggle={() => onChange(toggleTag(value, tag))}
                />
            ))}
            {counted.map(({ name, count }) => (
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

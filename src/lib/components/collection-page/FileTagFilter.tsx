import { fetchTagCounts, tagCountsUrl } from "@/lib/client/tags";
import useSWR from "swr";
import { TagToggles } from "../filters/TagToggle";

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
    const { data: tagCounts = [] } = useSWR(
        tagCountsUrl("files", collectionId),
        fetchTagCounts,
        { revalidateOnFocus: false }
    );
    if (tagCounts.length === 0 && value.length === 0) {
        return null;
    }
    return (
        <TagToggles
            role="group"
            aria-label="Filter files by tag"
            flex="1"
            minW="0"
            gap="1.5"
            overflowX="auto"
            css={{ scrollbarWidth: "none" }}
            tagCounts={tagCounts}
            value={value}
            onChange={onChange}
        />
    );
}

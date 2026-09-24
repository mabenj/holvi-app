import { COLLECTION_SORTS, CollectionSort } from "@/lib/types/collection-sort";
import { NativeSelect } from "@chakra-ui/react";

const LABELS: Record<CollectionSort, string> = {
    random: "Random",
    lastAddedTo: "Last added to",
    recentlyOpened: "Recently opened",
    mostOpened: "Most opened",
    name: "Name A–Z"
};

interface CollectionSortSelectProps {
    value: CollectionSort;
    onChange: (sort: CollectionSort) => void;
}

/** Chooses the order of the Collections tab */
export default function CollectionSortSelect({
    value,
    onChange
}: CollectionSortSelectProps) {
    return (
        <NativeSelect.Root
            size="md"
            variant="subtle"
            width="auto"
            flexShrink="0">
            <NativeSelect.Field
                aria-label="Sort collections"
                value={value}
                onChange={(event) =>
                    onChange(event.target.value as CollectionSort)
                }>
                {COLLECTION_SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                        {LABELS[sort]}
                    </option>
                ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
        </NativeSelect.Root>
    );
}

import { FILE_SORTS, FileSort } from "@/lib/types/file-sort";
import { NativeSelect } from "@chakra-ui/react";

const LABELS: Record<FileSort, string> = {
    newest: "Newest first",
    oldest: "Oldest first",
    name: "By name"
};

interface FileSortSelectProps {
    value: FileSort;
    onChange: (sort: FileSort) => void;
}

/** Chooses the order of a collection's files */
export default function FileSortSelect({ value, onChange }: FileSortSelectProps) {
    return (
        <NativeSelect.Root size="sm" variant="subtle" width="auto">
            <NativeSelect.Field
                aria-label="Sort files"
                value={value}
                onChange={(event) => onChange(event.target.value as FileSort)}>
                {FILE_SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                        {LABELS[sort]}
                    </option>
                ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
        </NativeSelect.Root>
    );
}

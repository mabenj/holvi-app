import { fetchTagCounts, tagCountsUrl } from "@/lib/client/tags";
import type { TagCount } from "@/lib/types/tag-count";
import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import useSWR from "swr";
import {
    ClearFiltersChip,
    FilterButton,
    FilterChip
} from "../filters/FilterControls";
import { TagToggles, toggleTag } from "../filters/TagToggle";
import PanelSurface from "../surfaces/PanelSurface";

interface TimelineTagFilterProps {
    /** The selected tags; files must have all of them, each on the file or its collection */
    value: string[];
    onChange: (tags: string[]) => void;
}

/** Opens the panel for picking the tags the Timeline is filtered by */
export function TimelineFilterButton({
    value,
    onChange
}: TimelineTagFilterProps) {
    const [panelOpen, setPanelOpen] = useState(false);
    return (
        <>
            <FilterButton
                activeCount={value.length}
                onClick={() => setPanelOpen(true)}
            />
            <TagPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                value={value}
                onChange={onChange}
            />
        </>
    );
}

/**
 * The tags the Timeline is filtered by, each removable, with one tap to clear
 * them all; nothing while there are none
 */
export function ActiveTagFilters({ value, onChange }: TimelineTagFilterProps) {
    if (value.length === 0) {
        return null;
    }
    return (
        <Flex
            role="group"
            aria-label="Active filters"
            gap="1.5"
            px="4"
            pb="3"
            overflowX="auto"
            alignItems="center"
            // Chips scroll sideways instead of wrapping into many rows
            css={{ scrollbarWidth: "none" }}>
            <ClearFiltersChip onClear={() => onChange([])} />
            {value.map((tag) => (
                <FilterChip
                    key={tag}
                    label={tag}
                    removeLabel={`Remove tag ${tag}`}
                    onRemove={() => onChange(toggleTag(value, tag))}
                />
            ))}
        </Flex>
    );
}

/** The user's tags from collections and files alike, since either can match */
function TagPanel({
    open,
    onClose,
    value,
    onChange
}: TimelineTagFilterProps & { open: boolean; onClose: () => void }) {
    const collectionTags = useSWR(
        open ? tagCountsUrl("collections") : null,
        fetchTagCounts
    );
    const fileTags = useSWR(open ? tagCountsUrl("files") : null, fetchTagCounts);
    const error = collectionTags.error ?? fileTags.error;
    const tags =
        collectionTags.data && fileTags.data
            ? combineTags(collectionTags.data, fileTags.data)
            : undefined;

    return (
        <PanelSurface
            open={open}
            onClose={onClose}
            title="Filter by tag"
            description="Show only files with every selected tag"
            headerAction={
                value.length > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                        Reset
                    </Button>
                ) : undefined
            }>
            <Stack gap="2">
                <Text textStyle="xs" color="fg.subtle">
                    Files must have every selected tag, on the file or on its
                    collection
                </Text>
                {error ? (
                    <Text color="fg.muted">{error.message}</Text>
                ) : !tags ? (
                    <Text color="fg.muted">Loading tags…</Text>
                ) : tags.length === 0 && value.length === 0 ? (
                    <Text color="fg.muted">No collection or file has tags yet</Text>
                ) : (
                    <TagToggles
                        wrap="wrap"
                        tagCounts={tags}
                        value={value}
                        onChange={onChange}
                    />
                )}
            </Stack>
        </PanelSurface>
    );
}

/**
 * Collection tags and file tags as one list, most used across both first. The
 * counts are left out: collections and files are counted apart, so neither is
 * the number of files a tag matches.
 */
function combineTags(
    collectionTags: TagCount[],
    fileTags: TagCount[]
): { name: string }[] {
    const uses = new Map<string, { name: string; count: number }>();
    for (const { name, count } of [...collectionTags, ...fileTags]) {
        const key = name.toLowerCase();
        const tag = uses.get(key) ?? { name, count: 0 };
        tag.count += count;
        uses.set(key, tag);
    }
    return Array.from(uses.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map(({ name }) => ({ name }));
}

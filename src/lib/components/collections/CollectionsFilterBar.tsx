import { CollectionsFilter, isFiltering } from "@/lib/client/collections";
import { fetchTagCounts, tagCountsUrl } from "@/lib/client/tags";
import {
    COLLECTION_FILE_TYPES,
    CollectionFileType
} from "@/lib/types/collection-file-type";
import {
    Button,
    CloseButton,
    Flex,
    Heading,
    HStack,
    Input,
    InputGroup,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiMagnify } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
    ActiveFilterChips,
    FilterButton,
    FilterChip
} from "../filters/FilterControls";
import { TagToggles, toggleTag } from "../filters/TagToggle";
import PanelSurface from "../surfaces/PanelSurface";

export const FILE_TYPE_LABELS: Record<CollectionFileType, string> = {
    any: "Any",
    hasVideos: "Has videos",
    photosOnly: "Photos only",
    videosOnly: "Videos only"
};

/** How long typing pauses before the search runs */
const SEARCH_DELAY_MS = 300;

interface CollectionsFilterBarProps {
    filter: CollectionsFilter;
    onChange: (changes: Partial<CollectionsFilter>) => void;
}

/**
 * The Collections tab's name search, its filter panel of tags and file type,
 * and the filters in effect, each removable, with one tap to clear them all
 */
export default function CollectionsFilterBar({
    filter,
    onChange
}: CollectionsFilterBarProps) {
    const [panelOpen, setPanelOpen] = useState(false);
    const panelFilters = filter.tags.length + (filter.fileType !== "any" ? 1 : 0);

    return (
        <Stack gap="2" px="4" pb="3">
            <HStack gap="2">
                <SearchField value={filter.q} onChange={(q) => onChange({ q })} />
                <FilterButton
                    activeCount={panelFilters}
                    onClick={() => setPanelOpen(true)}
                />
            </HStack>
            {isFiltering(filter) && (
                <ActiveFilters filter={filter} onChange={onChange} />
            )}
            <FilterPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                filter={filter}
                onChange={onChange}
            />
        </Stack>
    );
}

/** Searches collection names as the user types, once typing pauses */
function SearchField({
    value,
    onChange
}: {
    value: string;
    onChange: (q: string) => void;
}) {
    const [text, setText] = useState(value);
    // The latest callback, without restarting the pause on every render
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // The search can change elsewhere, e.g. when filters are cleared
    useEffect(() => setText(value), [value]);

    useEffect(() => {
        if (text === value) return;
        const timer = setTimeout(
            () => onChangeRef.current(text),
            SEARCH_DELAY_MS
        );
        return () => clearTimeout(timer);
    }, [text, value]);

    return (
        <InputGroup
            flex="1"
            startElement={<Icon path={mdiMagnify} size="20px" aria-hidden />}
            endElement={
                text ? (
                    <CloseButton
                        size="xs"
                        aria-label="Clear search"
                        me="-2"
                        onClick={() => {
                            setText("");
                            onChange("");
                        }}
                    />
                ) : undefined
            }>
            <Input
                type="search"
                enterKeyHint="search"
                aria-label="Search collections by name"
                placeholder="Search collections"
                variant="subtle"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        onChange(text);
                        event.currentTarget.blur();
                    }
                }}
                // The browser's own clear button would duplicate ours
                css={{
                    "&::-webkit-search-cancel-button": { display: "none" }
                }}
            />
        </InputGroup>
    );
}

/** The filters in effect: each removable on its own, or all at once */
function ActiveFilters({ filter, onChange }: CollectionsFilterBarProps) {
    const search = filter.q.trim();
    return (
        <ActiveFilterChips
            onClearAll={() => onChange({ tags: [], fileType: "any", q: "" })}>
            {search && (
                <FilterChip
                    label={`“${search}”`}
                    removeLabel="Clear search"
                    onRemove={() => onChange({ q: "" })}
                />
            )}
            {filter.fileType !== "any" && (
                <FilterChip
                    label={FILE_TYPE_LABELS[filter.fileType]}
                    removeLabel={`Remove filter ${FILE_TYPE_LABELS[filter.fileType]}`}
                    onRemove={() => onChange({ fileType: "any" })}
                />
            )}
            {filter.tags.map((tag) => (
                <FilterChip
                    key={tag}
                    label={tag}
                    removeLabel={`Remove tag ${tag}`}
                    onRemove={() =>
                        onChange({ tags: toggleTag(filter.tags, tag) })
                    }
                />
            ))}
        </ActiveFilterChips>
    );
}

/** Tags, most used first with their counts, and the file type; changes apply at once */
function FilterPanel({
    open,
    onClose,
    filter,
    onChange
}: CollectionsFilterBarProps & { open: boolean; onClose: () => void }) {
    const { data: tagCounts, error } = useSWR(
        open ? tagCountsUrl("collections") : null,
        fetchTagCounts
    );
    const panelFilters = filter.tags.length > 0 || filter.fileType !== "any";

    return (
        <PanelSurface
            open={open}
            onClose={onClose}
            title="Filters"
            description="Narrow the collections by file type and tags"
            headerAction={
                panelFilters ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onChange({ tags: [], fileType: "any" })}>
                        Reset
                    </Button>
                ) : undefined
            }>
            <Stack gap="6">
                <Stack gap="2" as="section">
                    <Heading as="h3" textStyle="sm" color="fg.muted">
                        File type
                    </Heading>
                    <Flex gap="2" wrap="wrap" role="radiogroup" aria-label="File type">
                        {COLLECTION_FILE_TYPES.map((fileType) => (
                            <Button
                                key={fileType}
                                size="sm"
                                rounded="full"
                                role="radio"
                                aria-checked={filter.fileType === fileType}
                                variant={
                                    filter.fileType === fileType
                                        ? "solid"
                                        : "outline"
                                }
                                onClick={() => onChange({ fileType })}>
                                {FILE_TYPE_LABELS[fileType]}
                            </Button>
                        ))}
                    </Flex>
                </Stack>
                <Stack gap="2" as="section">
                    <Heading as="h3" textStyle="sm" color="fg.muted">
                        Tags
                    </Heading>
                    <Text textStyle="xs" color="fg.subtle">
                        Collections must have every selected tag
                    </Text>
                    {error ? (
                        <Text color="fg.muted">{error.message}</Text>
                    ) : !tagCounts ? (
                        <Text color="fg.muted">Loading tags…</Text>
                    ) : tagCounts.length === 0 && filter.tags.length === 0 ? (
                        <Text color="fg.muted">No collection has tags yet</Text>
                    ) : (
                        <TagToggles
                            wrap="wrap"
                            tagCounts={tagCounts}
                            value={filter.tags}
                            onChange={(tags) => onChange({ tags })}
                        />
                    )}
                </Stack>
            </Stack>
        </PanelSurface>
    );
}

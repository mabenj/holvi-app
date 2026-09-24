import {
    CollectionsFilter,
    isFiltering,
    NO_COLLECTIONS_FILTER
} from "@/lib/client/collections";
import { fetchTagCounts, tagCountsUrl } from "@/lib/client/tags";
import {
    COLLECTION_FILE_TYPES,
    CollectionFileType
} from "@/lib/types/collection-file-type";
import type { CollectionSort } from "@/lib/types/collection-sort";
import {
    Button,
    CloseButton,
    Flex,
    Heading,
    HStack,
    Input,
    InputGroup,
    Stack,
    Switch,
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
import CollectionSortSelect from "./CollectionSortSelect";

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

/** How many of the filter panel's filters are on */
function panelFilterCount(filter: CollectionsFilter) {
    return (
        filter.tags.length +
        (filter.fileType !== "any" ? 1 : 0) +
        (filter.forgotten ? 1 : 0)
    );
}

/** Label of the Forgotten collections filter */
const FORGOTTEN_LABEL = "Forgotten";

/**
 * The Collections tab's name search, its sort, its filter panel of Forgotten
 * collections, file type and tags, and the filters in effect, each removable,
 * with one tap to clear them all
 */
export default function CollectionsFilterBar({
    filter,
    onChange,
    sort,
    onSortChange
}: CollectionsFilterBarProps & {
    sort: CollectionSort;
    onSortChange: (sort: CollectionSort) => void;
}) {
    const [panelOpen, setPanelOpen] = useState(false);
    const panelFilters = panelFilterCount(filter);

    return (
        <Stack gap="2" px="4" pb="3">
            <HStack gap="2">
                <SearchField value={filter.q} onChange={(q) => onChange({ q })} />
                <CollectionSortSelect value={sort} onChange={onSortChange} />
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
            onClearAll={() => onChange(NO_COLLECTIONS_FILTER)}>
            {search && (
                <FilterChip
                    label={`“${search}”`}
                    removeLabel="Clear search"
                    onRemove={() => onChange({ q: "" })}
                />
            )}
            {filter.forgotten && (
                <FilterChip
                    label={FORGOTTEN_LABEL}
                    removeLabel={`Remove filter ${FORGOTTEN_LABEL}`}
                    onRemove={() => onChange({ forgotten: false })}
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

/** Forgotten collections, the file type, and tags, most used first with their counts; changes apply at once */
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
    const panelFilters = panelFilterCount(filter) > 0;

    return (
        <PanelSurface
            open={open}
            onClose={onClose}
            title="Filters"
            description="Narrow the collections to forgotten ones, by file type and by tags"
            headerAction={
                panelFilters ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        // The panel's filters only; the search stays
                        onClick={() =>
                            onChange({ ...NO_COLLECTIONS_FILTER, q: filter.q })
                        }>
                        Reset
                    </Button>
                ) : undefined
            }>
            <Stack gap="6">
                <Switch.Root
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="4"
                    checked={filter.forgotten}
                    onCheckedChange={({ checked }) =>
                        onChange({ forgotten: checked })
                    }>
                    <Switch.Label flex="1">
                        <Text as="span" display="block" fontWeight="medium">
                            {FORGOTTEN_LABEL}
                        </Text>
                        <Text
                            as="span"
                            display="block"
                            textStyle="xs"
                            color="fg.subtle"
                            fontWeight="normal">
                            Not opened for over a year, or never opened and
                            created over a year ago
                        </Text>
                    </Switch.Label>
                    <Switch.HiddenInput />
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Root>
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

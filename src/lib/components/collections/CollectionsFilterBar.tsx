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
    Float,
    Circle,
    Heading,
    HStack,
    IconButton,
    Input,
    InputGroup,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiClose, mdiFilterVariant, mdiMagnify } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
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
                <IconButton
                    aria-label={
                        panelFilters > 0
                            ? `Filters, ${panelFilters} on`
                            : "Filters"
                    }
                    variant={panelFilters > 0 ? "subtle" : "ghost"}
                    position="relative"
                    onClick={() => setPanelOpen(true)}>
                    <Icon path={mdiFilterVariant} size="24px" aria-hidden />
                    {panelFilters > 0 && (
                        <Float placement="top-end" offset="1.5">
                            <Circle
                                size="4.5"
                                bg="colorPalette.solid"
                                color="colorPalette.contrast"
                                fontSize="2xs"
                                fontWeight="bold">
                                {panelFilters}
                            </Circle>
                        </Float>
                    )}
                </IconButton>
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
        <Flex
            role="group"
            aria-label="Active filters"
            gap="1.5"
            overflowX="auto"
            alignItems="center"
            // Chips scroll sideways instead of wrapping into many rows
            css={{ scrollbarWidth: "none" }}>
            <Button
                size="xs"
                variant="solid"
                rounded="full"
                flexShrink="0"
                onClick={() =>
                    onChange({ tags: [], fileType: "any", q: "" })
                }>
                <Icon path={mdiClose} size="14px" aria-hidden />
                Clear all
            </Button>
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
        </Flex>
    );
}

function FilterChip({
    label,
    removeLabel,
    onRemove
}: {
    label: string;
    removeLabel: string;
    onRemove: () => void;
}) {
    return (
        <Button
            size="xs"
            variant="subtle"
            rounded="full"
            flexShrink="0"
            maxW="60vw"
            aria-label={removeLabel}
            onClick={onRemove}>
            <Text as="span" truncate>
                {label}
            </Text>
            <Icon path={mdiClose} size="14px" aria-hidden />
        </Button>
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

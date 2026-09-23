import {
    bulkTag,
    fetchTagCounts,
    revalidateTagCounts,
    tagCountsUrl
} from "@/lib/client/tags";
import { getErrorMessage, plural } from "@/lib/common/utilities";
import EditorSurface from "@/lib/components/surfaces/EditorSurface";
import type { TagsById } from "@/lib/types/bulk-tag";
import { TAG_MAX_LENGTH, TagScope } from "@/lib/types/tag-count";
import {
    Button,
    Checkbox,
    Flex,
    Input,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiPlus } from "@mdi/js";
import Icon from "@mdi/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const FORM_ID = "bulk-tag-sheet";

/** How much of the selection has a tag */
type Coverage = "all" | "some" | "none";

interface TagRow {
    name: string;
    /** As the sheet opened */
    initial: Coverage;
    /** As the user has set it */
    current: Coverage;
}

interface BulkTagSheetProps {
    open: boolean;
    onClose: () => void;
    /** What is selected: collections or files */
    target: TagScope;
    /** The selected collections or files, with their tags */
    selected: { id: string; tags: string[] }[];
    /** Files only: offer the tags of this collection's files rather than of every file */
    collectionId?: string;
    /** Once the changes are saved, with each one's tags; the sheet stays open until the parent closes it */
    onApplied: (tags: TagsById) => void;
}

/**
 * Adds and removes tags across a selection. Each tag in scope is a tri-state
 * checkbox: on all, some or none of the selection. A new tag can be typed in.
 * Nothing changes until the user applies the changes.
 */
export default function BulkTagSheet({
    open,
    onClose,
    target,
    selected,
    collectionId,
    onApplied
}: BulkTagSheetProps) {
    const { data: tagCounts } = useSWR(
        open ? tagCountsUrl(target, collectionId) : null,
        fetchTagCounts
    );
    const [rows, setRows] = useState<TagRow[]>([]);
    const [input, setInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The tags on the selection, then the rest in scope, most used first
    const startingRows = useMemo(
        () => tagRows(selected, tagCounts?.map((tag) => tag.name) ?? []),
        [selected, tagCounts]
    );
    // Every opening starts afresh. Tags in scope may arrive after the sheet
    // opened; they join the list without undoing the user's changes.
    useEffect(() => {
        if (!open) return;
        setRows((previous) => mergeRows(previous, startingRows));
    }, [open, startingRows]);
    useEffect(() => {
        if (open) return;
        setRows([]);
        setInput("");
        setError(null);
    }, [open]);

    const typed = input.trim();
    const shown = typed
        ? rows.filter((row) => row.name.toLowerCase().includes(typed.toLowerCase()))
        : rows;
    const canAdd =
        typed.length > 0 &&
        typed.length <= TAG_MAX_LENGTH &&
        !rows.some((row) => sameTag(row.name, typed));

    const cycle = (name: string) =>
        setRows((current) =>
            current.map((row) =>
                sameTag(row.name, name)
                    ? { ...row, current: nextCoverage(row) }
                    : row
            )
        );

    const addTyped = () => {
        if (!canAdd) return;
        setRows((current) => [
            { name: typed, initial: "none", current: "all" },
            ...current
        ]);
        setInput("");
    };

    const apply = async (event: FormEvent) => {
        event.preventDefault();
        const add = rows
            .filter((row) => row.current === "all" && row.initial !== "all")
            .map((row) => row.name);
        const remove = rows
            .filter((row) => row.current === "none" && row.initial !== "none")
            .map((row) => row.name);
        if (add.length === 0 && remove.length === 0) {
            onClose();
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const tags = await bulkTag({
                target,
                ids: selected.map(({ id }) => id),
                add,
                remove
            });
            // Every tag count and filter showing the old tags
            revalidateTagCounts();
            onApplied(tags);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <EditorSurface
            open={open}
            onClose={onClose}
            title={`Tag ${plural(selected.length, target === "collections" ? "collection" : "file", target)}`}
            submitLabel="Apply"
            formId={FORM_ID}
            submitting={saving}>
            <form id={FORM_ID} onSubmit={apply} noValidate>
                <Stack gap="4">
                    <Flex gap="2">
                        <Input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                // Enter adds the typed tag rather than applying
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    addTyped();
                                }
                            }}
                            placeholder="Find or add a tag"
                            aria-label="Find or add a tag"
                            autoComplete="off"
                            maxLength={TAG_MAX_LENGTH}
                        />
                        <Button
                            variant="outline"
                            onClick={addTyped}
                            disabled={!canAdd}
                            aria-label={canAdd ? `Add tag ${typed}` : "Add tag"}>
                            <Icon path={mdiPlus} size="20px" aria-hidden />
                            Add
                        </Button>
                    </Flex>
                    {shown.length === 0 ? (
                        <Text color="fg.muted" textStyle="sm">
                            {typed
                                ? "No tag matches. Add it as a new tag."
                                : "No tags yet. Type one to add it."}
                        </Text>
                    ) : (
                        <Stack gap="1" as="ul" listStyleType="none">
                            {shown.map((row) => (
                                <li key={row.name.toLowerCase()}>
                                    <TagCheckbox
                                        row={row}
                                        onToggle={() => cycle(row.name)}
                                    />
                                </li>
                            ))}
                        </Stack>
                    )}
                    {error && (
                        <Text color="fg.error" textStyle="sm" role="alert">
                            {error}
                        </Text>
                    )}
                </Stack>
            </form>
        </EditorSurface>
    );
}

const COVERAGE_LABEL: Record<Coverage, string> = {
    all: "on all",
    some: "on some",
    none: "on none"
};

function TagCheckbox({ row, onToggle }: { row: TagRow; onToggle: () => void }) {
    const changed = row.current !== row.initial;
    return (
        <Checkbox.Root
            checked={
                row.current === "all"
                    ? true
                    : row.current === "some"
                      ? "indeterminate"
                      : false
            }
            // The next state is the sheet's own: some, then all, then none
            onCheckedChange={onToggle}
            w="100%"
            py="2"
            gap="3">
            <Checkbox.HiddenInput />
            <Checkbox.Control>
                <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label flex="1" fontWeight={changed ? "semibold" : "normal"}>
                {row.name}
            </Checkbox.Label>
            <Text as="span" textStyle="xs" color="fg.muted">
                {COVERAGE_LABEL[row.current]}
            </Text>
        </Checkbox.Root>
    );
}

/** Tags differ only in case are the same tag */
function sameTag(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
}

/** Each tag on the selection with how much of it has the tag, then the other tags in scope */
function tagRows(
    selected: { tags: string[] }[],
    tagsInScope: string[]
): TagRow[] {
    const counts = new Map<string, { name: string; count: number }>();
    for (const { tags } of selected) {
        for (const tag of Array.from(new Set(tags.map((t) => t.toLowerCase())))) {
            const name = tags.find((t) => t.toLowerCase() === tag)!;
            const entry = counts.get(tag) ?? { name, count: 0 };
            entry.count++;
            counts.set(tag, entry);
        }
    }
    const onSelection = Array.from(counts.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map(({ name, count }): TagRow => {
            const coverage = count === selected.length ? "all" : "some";
            return { name, initial: coverage, current: coverage };
        });
    const others = tagsInScope
        .filter((name) => !counts.has(name.toLowerCase()))
        .map((name): TagRow => ({ name, initial: "none", current: "none" }));
    return [...onSelection, ...others];
}

/** The starting rows, with the user's changes and new tags kept */
function mergeRows(previous: TagRow[], starting: TagRow[]): TagRow[] {
    const kept = new Map(previous.map((row) => [row.name.toLowerCase(), row]));
    const merged = starting.map((row) => kept.get(row.name.toLowerCase()) ?? row);
    const added = previous.filter(
        (row) => !starting.some((start) => sameTag(start.name, row.name))
    );
    return [...added, ...merged];
}

/** A tag on some of the selection goes to all, none and back to some; others between all and none */
function nextCoverage({ initial, current }: TagRow): Coverage {
    if (current === "some") return "all";
    if (current === "all") return "none";
    return initial === "some" ? "some" : "all";
}

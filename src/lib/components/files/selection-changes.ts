import type { FileFields } from "@/lib/client/collections";
import type { usePagedFiles } from "@/lib/hooks/usePagedFiles";
import type { TagsById } from "@/lib/types/bulk-tag";
import type { FileSummary } from "@/lib/types/file-summary";

type PagedFiles = Pick<ReturnType<typeof usePagedFiles>, "reload" | "changeFiles">;

/**
 * Shows what the file selection bar changed in a grid of paged files, e.g. on a
 * collection page or the Timeline, without fetching them again. With a tag
 * filter on, files whose tags changed may no longer match it, so an edit or
 * bulk tagging fetches the files afresh instead.
 */
export function showSelectionChanges(
    { reload, changeFiles }: PagedFiles,
    tagFiltered: boolean
) {
    const changeTaggedFiles = (
        change: (files: FileSummary[]) => FileSummary[]
    ) => (tagFiltered ? reload() : changeFiles(change));
    return {
        onDeleted: (fileIds: string[]) =>
            changeFiles((loaded) =>
                loaded.filter((file) => !fileIds.includes(file.id))
            ),
        onEdited: (fileId: string, fields: FileFields) =>
            changeTaggedFiles((loaded) =>
                loaded.map((file) =>
                    file.id === fileId ? { ...file, ...fields } : file
                )
            ),
        onTagged: (tagsById: TagsById) =>
            changeTaggedFiles((loaded) =>
                loaded.map((file) =>
                    tagsById[file.id] ? { ...file, tags: tagsById[file.id] } : file
                )
            )
    };
}

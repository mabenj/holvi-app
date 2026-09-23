import { deleteSelection, FileFields } from "@/lib/client/collections";
import { revalidateTagCounts } from "@/lib/client/tags";
import type { Selection } from "@/lib/hooks/useSelection";
import type { TagsById } from "@/lib/types/bulk-tag";
import type { FileSummary } from "@/lib/types/file-summary";
import { useState } from "react";
import BulkTagSheet from "../selection/BulkTagSheet";
import SelectionBar from "../selection/SelectionBar";
import FileEditor from "./FileEditor";

interface FileSelectionBarProps {
    selection: Selection;
    /** The selected files, as the grid shows them */
    selected: FileSummary[];
    /** Where the files are all from one collection: the bulk-tag sheet offers that collection's file tags */
    collectionId?: string;
    /** After the files were deleted */
    onDeleted: (fileIds: string[]) => void;
    /** After one file's name and tags were saved */
    onEdited: (fileId: string, fields: FileFields) => void;
    /** After bulk tagging, with each file's tags */
    onTagged: (tags: TagsById) => void;
}

/**
 * The selection bar for files, on a collection page or the Timeline: deletes,
 * edits or tags the selected files, reports the change and leaves selection
 * mode.
 */
export default function FileSelectionBar({
    selection,
    selected,
    collectionId,
    onDeleted,
    onEdited,
    onTagged
}: FileSelectionBarProps) {
    const [editing, setEditing] = useState(false);
    const [tagging, setTagging] = useState(false);
    const editedFile = selected.length === 1 ? selected[0] : null;

    const deleteSelected = async () => {
        const ids = selected.map((file) => file.id);
        await deleteSelection(ids);
        onDeleted(ids);
        revalidateTagCounts();
        selection.exit();
    };

    return (
        <>
            <SelectionBar
                count={selected.length}
                noun={["file", "files"]}
                onExit={selection.exit}
                onDelete={deleteSelected}
                onEdit={() => setEditing(true)}
                onTag={() => setTagging(true)}
                escapeLeaves={!editing && !tagging}
            />
            {editedFile && (
                <FileEditor
                    open={editing}
                    onClose={() => setEditing(false)}
                    file={editedFile}
                    onSaved={(fields) => {
                        onEdited(editedFile.id, fields);
                        revalidateTagCounts();
                        setEditing(false);
                        selection.exit();
                    }}
                />
            )}
            <BulkTagSheet
                open={tagging}
                onClose={() => setTagging(false)}
                target="files"
                items={selected}
                collectionId={collectionId}
                onApplied={(tags) => {
                    onTagged(tags);
                    setTagging(false);
                    selection.exit();
                }}
            />
        </>
    );
}

import { deleteSelection, fetchCollection } from "@/lib/client/collections";
import { revalidateTagCounts } from "@/lib/client/tags";
import { getErrorMessage } from "@/lib/common/utilities";
import {
    removeCollection,
    replaceCollection
} from "@/lib/hooks/useCollectionsBrowse";
import type { Selection } from "@/lib/hooks/useSelection";
import type { CollectionDetails } from "@/lib/types/collection-details";
import type { CollectionSummary } from "@/lib/types/collection-summary";
import { useState } from "react";
import BulkTagSheet from "../selection/BulkTagSheet";
import SelectionBar from "../selection/SelectionBar";
import CollectionEditor from "./CollectionEditor";

interface CollectionSelectionBarProps {
    userId: string;
    selection: Selection;
    /** The selected collections, as the tab shows them */
    selected: CollectionSummary[];
    /** Shows why an action could not start, e.g. the collection to edit did not load */
    onError: (message: string) => void;
}

/**
 * The Collections tab's selection bar: deletes, edits or tags the selected
 * collections, shows the changes on the tab and leaves selection mode.
 */
export default function CollectionSelectionBar({
    userId,
    selection,
    selected,
    onError
}: CollectionSelectionBarProps) {
    const [editing, setEditing] = useState<CollectionDetails | null>(null);
    const [tagging, setTagging] = useState(false);

    const deleteSelected = async () => {
        const ids = selected.map((collection) => collection.id);
        await deleteSelection(ids);
        ids.forEach((id) => removeCollection(userId, id));
        revalidateTagCounts();
        selection.exit();
    };

    // The summary has no description, which the editor needs
    const edit = async () => {
        try {
            setEditing(await fetchCollection(selected[0].id));
        } catch (error) {
            onError(getErrorMessage(error));
        }
    };

    const fileCount = selected.reduce(
        (sum, collection) => sum + collection.imageCount + collection.videoCount,
        0
    );
    return (
        <>
            <SelectionBar
                count={selected.length}
                noun={["collection", "collections"]}
                onExit={selection.exit}
                onDelete={deleteSelected}
                deleteWarning={
                    fileCount === 0
                        ? undefined
                        : `The selected ${selected.length === 1 ? "collection" : "collections"} and ${fileCount === 1 ? "its file" : `their ${fileCount} files`} will be deleted.`
                }
                onEdit={edit}
                onTag={() => setTagging(true)}
                escapeLeaves={!editing && !tagging}
            />
            {editing && (
                <CollectionEditor
                    open
                    onClose={() => setEditing(null)}
                    collection={editing}
                    onSaved={async (collectionId) => {
                        replaceCollection(
                            userId,
                            await fetchCollection(collectionId)
                        );
                        revalidateTagCounts();
                        setEditing(null);
                        selection.exit();
                    }}
                />
            )}
            <BulkTagSheet
                open={tagging}
                onClose={() => setTagging(false)}
                target="collections"
                items={selected}
                onApplied={(tags) => {
                    selected.forEach((collection) =>
                        replaceCollection(userId, {
                            ...collection,
                            tags: tags[collection.id] ?? collection.tags
                        })
                    );
                    setTagging(false);
                    selection.exit();
                }}
            />
        </>
    );
}

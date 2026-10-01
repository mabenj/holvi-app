import { setCover } from "@/lib/client/collections";
import { getErrorMessage } from "@/lib/common/utilities";
import { FileSummary } from "@/lib/types/file-summary";
import {
    mdiAlertCircleOutline,
    mdiImageCheck,
    mdiImageCheckOutline
} from "@mdi/js";
import { useState } from "react";
import LightboxBarButton from "./LightboxBarButton";

interface SetAsCoverProps {
    file: FileSummary;
    /** Whether the file is the collection's Chosen cover; not so for its Rotating cover */
    isChosenCover: boolean;
    /** Called once the Cover is chosen or un-chosen, to show it on the collection's card */
    onChange: () => Promise<unknown> | void;
}

/**
 * A lightbox action on a collection page: a toggle that makes the active
 * file, a photo or a video, the collection's Chosen cover. Pressed, and
 * filled, only on the Chosen cover; pressing it then un-chooses it, so the
 * collection's Cover rotates again.
 */
export default function SetAsCover({
    file,
    isChosenCover,
    onChange
}: SetAsCoverProps) {
    const [saving, setSaving] = useState(false);
    // The failure of the file it happened to; another file starts afresh
    const [failure, setFailure] = useState<{
        fileId: string;
        message: string;
    }>();
    const failed = failure?.fileId === file.id ? failure.message : null;

    const toggle = async () => {
        setSaving(true);
        setFailure(undefined);
        try {
            await setCover(file.collectionId, isChosenCover ? null : file.id);
            await onChange();
        } catch (error) {
            setFailure({ fileId: file.id, message: getErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    };

    const description = failed
        ? isChosenCover
            ? `Could not let the cover rotate: ${failed}`
            : `Could not set as cover: ${failed}`
        : isChosenCover
          ? "The chosen cover of this collection. Press to let the cover rotate"
          : "Set as cover";

    return (
        <LightboxBarButton
            label={description}
            aria-pressed={isChosenCover}
            title={description}
            icon={
                failed
                    ? mdiAlertCircleOutline
                    : isChosenCover
                      ? mdiImageCheck
                      : mdiImageCheckOutline
            }
            disabled={saving}
            opacity={saving ? 0.5 : undefined}
            onClick={() => void toggle()}
        />
    );
}

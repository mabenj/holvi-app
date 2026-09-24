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
    /** Whether the file is the collection's Cover already, chosen or automatic */
    isCover: boolean;
    /** Called once the file is the Cover, to show it on the hero and the card */
    onSet: () => Promise<unknown> | void;
}

/**
 * A lightbox action on a collection page: makes the active file, a photo or
 * a video, the collection's Cover. Filled while the file is the Cover.
 */
export default function SetAsCover({ file, isCover, onSet }: SetAsCoverProps) {
    const [saving, setSaving] = useState(false);
    // The failure of the file it happened to; another file starts afresh
    const [failure, setFailure] = useState<{
        fileId: string;
        message: string;
    }>();
    const failed = failure?.fileId === file.id ? failure.message : null;

    const choose = async () => {
        setSaving(true);
        setFailure(undefined);
        try {
            await setCover(file.collectionId, file.id);
            await onSet();
        } catch (error) {
            setFailure({ fileId: file.id, message: getErrorMessage(error) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <LightboxBarButton
            label={
                failed ? `Could not set as cover: ${failed}` : "Set as cover"
            }
            // Pressed, and filled, while the file is the Cover
            aria-pressed={isCover}
            title={
                failed
                    ? `Could not set as cover: ${failed}`
                    : isCover
                      ? "The cover of this collection"
                      : "Set as cover"
            }
            icon={
                failed
                    ? mdiAlertCircleOutline
                    : isCover
                      ? mdiImageCheck
                      : mdiImageCheckOutline
            }
            disabled={saving}
            opacity={saving ? 0.5 : undefined}
            onClick={() => void choose()}
        />
    );
}

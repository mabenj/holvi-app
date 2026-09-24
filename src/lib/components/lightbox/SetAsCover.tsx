import { setCover } from "@/lib/client/collections";
import { getErrorMessage } from "@/lib/common/utilities";
import { FileSummary } from "@/lib/types/file-summary";
import { chakra } from "@chakra-ui/react";
import {
    mdiAlertCircleOutline,
    mdiImageCheck,
    mdiImageCheckOutline
} from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import { TAPPABLE_WHILE_VISIBLE } from "./lightbox-controls";

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

    const label = failed
        ? `Could not set as cover: ${failed}`
        : isCover
          ? "Cover of this collection"
          : "Set as cover";
    return (
        <chakra.button
            type="button"
            // PhotoSwipe's own top-bar buttons, for size and feel
            className="pswp__button"
            title={label}
            aria-label={label}
            aria-pressed={isCover}
            disabled={saving}
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="var(--pswp-icon-color)"
            filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))"
            opacity={saving ? 0.5 : undefined}
            css={TAPPABLE_WHILE_VISIBLE}
            onClick={() => void choose()}>
            <Icon
                path={
                    failed
                        ? mdiAlertCircleOutline
                        : isCover
                          ? mdiImageCheck
                          : mdiImageCheckOutline
                }
                size="26px"
                aria-hidden
            />
        </chakra.button>
    );
}

import { chakra } from "@chakra-ui/react";
import { mdiImageMultipleOutline } from "@mdi/js";
import Icon from "@mdi/react";
import Router from "next/router";
import { TAPPABLE_WHILE_VISIBLE } from "./lightbox-controls";

/**
 * A lightbox action for a file on the Timeline: opens the file's collection.
 * Back from the collection returns to the Timeline.
 */
export default function GoToCollection({
    collectionId
}: {
    collectionId: string;
}) {
    return (
        <chakra.button
            type="button"
            // PhotoSwipe's own top-bar buttons, for size and feel
            className="pswp__button"
            title="Go to collection"
            aria-label="Go to collection"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="var(--pswp-icon-color)"
            filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))"
            css={TAPPABLE_WHILE_VISIBLE}
            onClick={() =>
                void Router.push(
                    `/collections/${encodeURIComponent(collectionId)}`
                )
            }>
            <Icon path={mdiImageMultipleOutline} size="26px" aria-hidden />
        </chakra.button>
    );
}

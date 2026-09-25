import { mdiImageMultipleOutline } from "@mdi/js";
import Router from "next/router";
import LightboxBarButton from "./LightboxBarButton";

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
        <LightboxBarButton
            label="Go to collection"
            icon={mdiImageMultipleOutline}
            onClick={() =>
                void Router.push(
                    `/collections/${encodeURIComponent(collectionId)}`
                )
            }
        />
    );
}

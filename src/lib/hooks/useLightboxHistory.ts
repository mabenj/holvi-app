import Router, { useRouter } from "next/router";
import { useCallback, useEffect } from "react";

/** Query parameter naming the file open in the lightbox */
const PHOTO_ID = "photoId";

/** Query changes for the lightbox neither reload the page nor scroll it */
const IN_PLACE = { shallow: true, scroll: false } as const;

/** Whether the lightbox pushed the current history entry, so closing it can go back */
let pushedEntry = false;
/** Whether the lightbox is on its way to a new history entry */
let opening = false;

function urlWithPhoto(fileId: string | null) {
    const { [PHOTO_ID]: _, ...query } = Router.query;
    return {
        pathname: Router.pathname,
        query: fileId ? { ...query, [PHOTO_ID]: fileId } : query
    };
}

/**
 * The lightbox's place in history: a shallow `?photoId=<fileId>` query on the
 * page it opens over, so Back (including the phone's back gesture) closes it
 */
export function useLightboxHistory() {
    const { query } = useRouter();
    const photoId =
        typeof query[PHOTO_ID] === "string" ? query[PHOTO_ID] : null;

    // Back or a reload leaves entries the lightbox did not push
    useEffect(() => {
        if (!photoId) pushedEntry = false;
    }, [photoId]);

    /** Opens the lightbox at a file, as a new history entry */
    const open = useCallback(async (fileId: string) => {
        // A second tap while it opens must not push another entry
        if (opening || Router.query[PHOTO_ID]) return;
        opening = true;
        // Back returns to the entry the page is on now. Next.js reloads and
        // scrolls to the top when going back to an entry that was not a
        // shallow one, so it is made into one first
        try {
            await Router.replace(Router.asPath, undefined, IN_PLACE);
            await Router.push(urlWithPhoto(fileId), undefined, IN_PLACE);
            pushedEntry = true;
        } finally {
            opening = false;
        }
    }, []);

    /** Records the file the lightbox has moved to, without a new history entry */
    const show = useCallback((fileId: string) => {
        if (Router.query[PHOTO_ID] === fileId) return;
        void Router.replace(urlWithPhoto(fileId), undefined, IN_PLACE);
    }, []);

    /** Leaves the lightbox's history entry once the lightbox closes itself */
    const leave = useCallback(() => {
        if (pushedEntry) {
            pushedEntry = false;
            Router.back();
        } else {
            void Router.replace(urlWithPhoto(null), undefined, IN_PLACE);
        }
    }, []);

    return { photoId, open, show, leave };
}

import Router, { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

/** Query parameter marking the history entry that selection mode pushed */
const SELECTING = "selecting";

/** Selection's query changes neither reload the page nor scroll it */
const IN_PLACE = { shallow: true, scroll: false } as const;

function urlWithSelecting(selecting: boolean) {
    const { [SELECTING]: _, ...query } = Router.query;
    return {
        pathname: Router.pathname,
        query: selecting ? { ...query, [SELECTING]: "1" } : query
    };
}

export interface Selection {
    /** Whether selection mode is on: tapping then selects or deselects */
    selecting: boolean;
    /** Ids of the selected collections or files, in the order they were selected */
    selected: string[];
    isSelected: (id: string) => boolean;
    /** Enters selection mode with the collection or file selected, e.g. on a long-press */
    start: (id: string) => void;
    /** Adds the collection or file to the selection, or takes it out */
    toggle: (id: string) => void;
    /** Takes collections or files out of the selection, e.g. once they are deleted */
    deselect: (ids: string[]) => void;
    /** Leaves selection mode */
    exit: () => void;
}

/**
 * Selecting collections or files: a long-press enters selection mode (see
 * `useSelectionGestures`), taps then select or deselect, and Back (including
 * the phone's back gesture) leaves it, as does Escape in the selection bar.
 * Selection mode is a shallow `?selecting=1` history entry on the page, so
 * Back leaves it instead of the page.
 */
export function useSelection(): Selection {
    const { query } = useRouter();
    const marked = query[SELECTING] === "1";
    const [selected, setSelected] = useState<string[]>([]);
    const [selecting, setSelecting] = useState(false);
    /** Whether this page pushed the selection entry, so leaving can go back */
    const pushedEntry = useRef(false);

    // Back leaves the selection entry; a reload or a link can land on one that
    // this page did not push, with nothing selected
    useEffect(() => {
        if (marked && !pushedEntry.current) {
            void Router.replace(urlWithSelecting(false), undefined, IN_PLACE);
        } else if (!marked) {
            pushedEntry.current = false;
            setSelecting(false);
            setSelected([]);
        }
    }, [marked]);

    const start = useCallback(
        async (id: string) => {
            setSelected([id]);
            setSelecting(true);
            if (pushedEntry.current || Router.query[SELECTING]) return;
            pushedEntry.current = true;
            // Next.js reloads and scrolls to the top when going back to an
            // entry that was not a shallow one, so it is made into one first
            await Router.replace(Router.asPath, undefined, IN_PLACE);
            await Router.push(urlWithSelecting(true), undefined, IN_PLACE);
        },
        []
    );

    const toggle = useCallback((id: string) => {
        setSelected((current) =>
            current.includes(id)
                ? current.filter((selectedId) => selectedId !== id)
                : [...current, id]
        );
    }, []);

    const deselect = useCallback((ids: string[]) => {
        setSelected((current) => current.filter((id) => !ids.includes(id)));
    }, []);

    const exit = useCallback(() => {
        setSelecting(false);
        setSelected([]);
        // Once only, however often it is called before the entry goes
        if (pushedEntry.current) {
            pushedEntry.current = false;
            Router.back();
        }
    }, []);

    // Deselecting the last one leaves selection mode
    useEffect(() => {
        if (selecting && selected.length === 0) exit();
    }, [selecting, selected.length, exit]);

    const isSelected = useCallback(
        (id: string) => selected.includes(id),
        [selected]
    );

    return { selecting, selected, isSelected, start, toggle, deselect, exit };
}

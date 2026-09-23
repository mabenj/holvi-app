import type { NextRouter } from "next/router";

/** Screens shown in this app session after the first one */
let navigations = 0;

/** Counts the app's own navigations, so Back knows whether it would leave the app */
export function countNavigations(events: NextRouter["events"]) {
    const count = (_url: string, { shallow }: { shallow: boolean }) => {
        // Shallow changes stay on the same screen, e.g. the lightbox's query
        if (!shallow) navigations++;
    };
    events.on("routeChangeComplete", count);
    return () => events.off("routeChangeComplete", count);
}

/**
 * Goes back in history when the previous screen belongs to this app session;
 * otherwise (e.g. a collection opened from a bookmark) goes to `fallback`
 */
export function goBack(router: NextRouter, fallback: string) {
    if (navigations > 0) {
        router.back();
    } else {
        void router.push(fallback);
    }
}

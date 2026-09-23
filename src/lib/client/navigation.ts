import type { NextRouter } from "next/router";

/** Screens shown in this app session after the first one */
let navigations = 0;
/** Path of the screen before the current one in this app session, if any */
let previousPath: string | null = null;
let currentPath: string | null = null;

/** Counts the app's own navigations, so Back knows whether it would leave the app */
export function countNavigations(events: NextRouter["events"]) {
    currentPath = window.location.pathname;
    const count = (url: string) => {
        navigations++;
        const path = new URL(url, window.location.origin).pathname;
        // Query-only changes, e.g. opening the lightbox, stay on the same screen
        if (path !== currentPath) {
            previousPath = currentPath;
            currentPath = path;
        }
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

/**
 * Leaves the current screen for `path`, e.g. after deleting what it showed:
 * back in history when the previous screen was `path`, so it returns to where
 * it was, and otherwise in place of the current screen
 */
export function leaveFor(router: NextRouter, path: string) {
    if (navigations > 0 && previousPath === path) {
        router.back();
    } else {
        void router.replace(path);
    }
}

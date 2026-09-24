import type { NextRouter } from "next/router";

/** The tab bar's screens, by the path each tab goes to */
export const TAB_PATHS = ["/", "/timeline", "/settings"] as const;

export type TabPath = (typeof TAB_PATHS)[number];

export type TabUrls = Readonly<Record<TabPath, string>>;

/**
 * Parameters of a moment on a screen rather than of what it shows: the file
 * open in the lightbox, and selection mode. Coming back to a tab leaves them.
 */
const MOMENTARY_PARAMS = ["photoId", "selecting"];

/**
 * The tab a URL is the screen of, and the URL to come back to it by: the same
 * sort and filters, without the lightbox or selection mode. Null for a URL
 * that is no tab's own screen, e.g. a collection page.
 */
export function tabReturn(url: string): { tab: TabPath; url: string } | null {
    const { pathname, searchParams } = new URL(url, "http://holvi");
    const tab = TAB_PATHS.find((path) => path === pathname);
    if (!tab) return null;
    MOMENTARY_PARAMS.forEach((name) => searchParams.delete(name));
    const search = searchParams.toString();
    return { tab, url: search ? `${tab}?${search}` : tab };
}

/** Each tab's own path, where it goes before its screen is visited */
const TAB_HOMES: TabUrls = {
    "/": "/",
    "/timeline": "/timeline",
    "/settings": "/settings"
};

/** The URL each tab returns to, for this app session */
let lastUrls: TabUrls = TAB_HOMES;
const listeners = new Set<() => void>();

function remember(url: string) {
    const visited = tabReturn(url);
    if (!visited || lastUrls[visited.tab] === visited.url) return;
    lastUrls = { ...lastUrls, [visited.tab]: visited.url };
    listeners.forEach((listener) => listener());
}

/**
 * Remembers the last URL of each tab's screen as the app moves between
 * screens and changes their sort and filters, so each tab returns to it
 */
export function rememberTabUrls(events: NextRouter["events"]) {
    remember(window.location.pathname + window.location.search);
    const onChange = (url: string) => remember(url);
    events.on("routeChangeComplete", onChange);
    return () => events.off("routeChangeComplete", onChange);
}

export function subscribeToTabUrls(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Where each tab goes: its screen's last URL in this app session, or its own path */
export function getTabUrls() {
    return lastUrls;
}

/** Where each tab goes when rendered on the server, and while hydrating */
export function getServerTabUrls() {
    return TAB_HOMES;
}

import type { NextRouter } from "next/router";

/** The tab bar's screens, by the path each tab goes to */
export const TAB_PATHS = ["/", "/timeline", "/settings"] as const;

/** The path of a tab's own screen */
export type TabPath = (typeof TAB_PATHS)[number];

/** The URL each tab goes to */
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

/** Where the tab URLs are kept, for the browser tab's session, so a reload keeps them */
const STORAGE_KEY = "holvi.tabUrls";

/**
 * The tab URLs kept in storage; each tab whose stored URL is missing or is
 * not its own screen's goes to its own path
 */
export function parseTabUrls(stored: string | null): TabUrls {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stored ?? "{}");
    } catch {
        parsed = {};
    }
    const urls = { ...TAB_HOMES };
    if (typeof parsed !== "object" || parsed === null) return urls;
    for (const tab of TAB_PATHS) {
        const url = (parsed as Record<string, unknown>)[tab];
        if (typeof url !== "string") continue;
        const visited = tabReturn(url);
        if (visited?.tab === tab) urls[tab] = visited.url;
    }
    return urls;
}

/** The URL each tab returns to, once read from storage */
let lastUrls: TabUrls | null = null;
const listeners = new Set<() => void>();

function readTabUrls(): TabUrls {
    try {
        return parseTabUrls(window.sessionStorage.getItem(STORAGE_KEY));
    } catch {
        // Storage can be unavailable, e.g. in some private windows
        return TAB_HOMES;
    }
}

function remember(url: string) {
    const visited = tabReturn(url);
    const urls = getTabUrls();
    if (!visited || urls[visited.tab] === visited.url) return;
    lastUrls = { ...urls, [visited.tab]: visited.url };
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lastUrls));
    } catch {
        // Without storage, the tabs return to their URLs until a reload
    }
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

/** Calls back when a tab's URL changes, e.g. for the tab bar's links */
export function subscribeToTabUrls(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Where each tab goes: its screen's last URL in this browser tab's session, or its own path */
export function getTabUrls(): TabUrls {
    lastUrls ??= readTabUrls();
    return lastUrls;
}

/** Where each tab goes when rendered on the server, and while hydrating */
export function getServerTabUrls() {
    return TAB_HOMES;
}

/**
 * Where to open a screen: a tab's screen at its last URL, with its sort and
 * filters; any other path as it is
 */
export function openingUrl(path: string) {
    const tab = TAB_PATHS.find((tabPath) => tabPath === path);
    return tab ? getTabUrls()[tab] : path;
}

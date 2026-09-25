import useSWR, { mutate } from "swr";
import { ACTIVITY_URL, getActivity } from "../client/activity";

const POLL_INTERVAL_MS = 2_000;

/**
 * The user's background work. Shared by every screen through SWR's cache, so
 * the tab badge and the Activity section poll once between them, and only
 * while something is active.
 */
export function useActivity() {
    const { data, error, isLoading } = useSWR(ACTIVITY_URL, getActivity, {
        refreshInterval: (latest) => (latest?.active ? POLL_INTERVAL_MS : 0)
    });
    return {
        activity: data,
        error: error as Error | undefined,
        isLoading
    };
}

/** Checks for background work again, e.g. after starting a Backup or uploading videos */
export function refreshActivity() {
    return mutate(ACTIVITY_URL);
}

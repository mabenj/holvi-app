import { Activity } from "../types/activity";

export const ACTIVITY_URL = "/api/activity";

/** The user's queued or running Backup job and how far video processing has got */
export async function getActivity() {
    const res = await fetch(ACTIVITY_URL);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== "ok") {
        throw new Error(data.error || "Could not load activity");
    }
    return data.activity as Activity;
}

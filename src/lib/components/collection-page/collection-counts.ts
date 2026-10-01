import { CollectionSummary } from "@/lib/types/collection-summary";

/**
 * How many photos and videos a collection holds, e.g. "12 photos · 3 videos".
 * Only the kinds it has are counted; an empty collection has no counts line.
 */
export function describeCounts({
    imageCount,
    videoCount
}: Pick<CollectionSummary, "imageCount" | "videoCount">): string | null {
    const parts = [
        imageCount > 0 &&
            `${imageCount} ${imageCount === 1 ? "photo" : "photos"}`,
        videoCount > 0 &&
            `${videoCount} ${videoCount === 1 ? "video" : "videos"}`
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
}

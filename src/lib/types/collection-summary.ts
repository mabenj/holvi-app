/** What the Collections tab shows of one collection */
export interface CollectionSummary {
    id: string;
    name: string;
    tags: string[];
    imageCount: number;
    videoCount: number;
    /** Up to 10 thumbnail sources: the Cover's first, then the other files by name */
    thumbnails: string[];
    /** Absent while the collection has no files */
    cover: {
        thumbnailSrc: string;
        blurDataUrl: string | null;
        /** Whether it is the Chosen cover, rather than the Rotating cover */
        chosen: boolean;
    } | null;
    /** Last added to, as epoch milliseconds */
    lastAddedTo: number;
}

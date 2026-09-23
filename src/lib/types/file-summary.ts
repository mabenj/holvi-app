import { CollectionFileDto } from "./collection-file-dto";

/** What a collection page shows of one file */
export interface FileSummary extends CollectionFileDto {
    /** Videos only: what the player streams. The original, until Renditions exist */
    playbackSrc?: string;
}

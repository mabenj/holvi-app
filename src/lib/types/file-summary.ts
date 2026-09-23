import { CollectionFileDto } from "./collection-file-dto";

/** What a collection page shows of one file */
export interface FileSummary extends CollectionFileDto {
    /** Videos only: what the player streams. The Rendition once it is ready, and the original until then */
    playbackSrc?: string;
}

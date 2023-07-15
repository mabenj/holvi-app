export type ItemType = "collection" | "image" | "video";

export interface CollectionGridItem {
    id: string;
    name: string;
    type: ItemType;
    tags: string[];
    timestamp: Date;
    src?: string;
    width?: number;
    height?: number;
    thumbnailSrc?: string;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    thumbnails?: string[]
}
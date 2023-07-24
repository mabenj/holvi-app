export interface CollectionDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    thumbnails: string[];
    timestamp: number;
    videoCount: number;
    imageCount: number;
}

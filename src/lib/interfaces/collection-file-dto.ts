export interface CollectionFileDto {
    id: string;
    collectionId: string;
    name: string;
    mimeType: string;
    src: string;
    thumbnailSrc: string;
    width?: number;
    height?: number;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    timestamp: number;
    tags: string[];
    gps?: {
        lat: number;
        long: number;
        alt?: number;
        label?: string;
    };
}

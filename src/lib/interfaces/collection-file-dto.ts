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
    createdAt: number;
    updatedAt: number;
}

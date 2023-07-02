export interface CollectionFile {
    id: number;
    collectionId: number;
    name: string;
    src: string;
    thumbnailSrc: string;
    type: "image" | "video";
    width: number;
    height: number;
}

import { CollectionDto } from "./collection-dto";
import { CollectionFileDto } from "./collection-file-dto";

export type CollectionGridItem = CollectionItem | ImageItem | VideoItem;

type CollectionItem = {
    type: "collection";
} & CollectionDto;

type ImageItem = {
    type: "image";
} & CollectionFileDto;

type VideoItem = {
    type: "video";
} & CollectionFileDto;

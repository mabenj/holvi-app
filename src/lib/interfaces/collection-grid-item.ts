import { CollectionDto } from "./collection-dto";
import { CollectionFileDto } from "./collection-file-dto";

export type CollectionGridItem = (CollectionDto | CollectionFileDto) & {
    type: string;
};

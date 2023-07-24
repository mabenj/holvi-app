import { CollectionDto } from "./collection-dto";
import { CollectionFileDto } from "./collection-file-dto";

export interface SearchResult {
    collections: CollectionDto[];
    files: CollectionFileDto[];
}

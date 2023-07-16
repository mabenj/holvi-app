import { CollectionDto } from "./collection-dto";

export interface CreateCollectionResponse {
    collection?: CollectionDto;
    nameError?: string
}

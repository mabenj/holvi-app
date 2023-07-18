import { CollectionDto } from "./collection-dto";

export interface UpdateCollectionResponse {
    collection?: CollectionDto;
    nameError?: string;
}

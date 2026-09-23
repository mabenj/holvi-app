import { CollectionSummary } from "./collection-summary";

/** What a collection page shows of the collection itself */
export interface CollectionDetails extends CollectionSummary {
    /** Empty when the collection has none */
    description: string;
}

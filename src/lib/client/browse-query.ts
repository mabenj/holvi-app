import type { ParsedUrlQuery } from "querystring";
import {
    COLLECTION_FILE_TYPES,
    CollectionFileType
} from "../types/collection-file-type";
import { CollectionsFilter, NO_COLLECTIONS_FILTER } from "./collections";

/**
 * The browsing screens' sort and filters in the URL query: on the Collections
 * tab `sort`, `tags`, `fileType`, `forgotten` and `q`; on a collection page
 * `sort` and `tags`; on the Timeline `tags`. A value at its default is left
 * out, and one that is not valid reads as the default. Other parameters, such
 * as the lightbox's `photoId`, are left alone. The Shuffle seed is never in
 * the URL (ADR 0001).
 */

/** Parameters to set in a URL query; undefined removes one */
export type QueryChanges = Record<string, string | string[] | undefined>;

/** The query with the changes made: parameters set, or removed where undefined, and the others kept */
export function withQueryChanges(
    query: ParsedUrlQuery,
    changes: QueryChanges
): ParsedUrlQuery {
    const next: ParsedUrlQuery = { ...query };
    for (const [name, value] of Object.entries(changes)) {
        if (value === undefined) delete next[name];
        else next[name] = value;
    }
    return next;
}

/** Whether making the changes would change the query */
export function hasQueryChanges(query: ParsedUrlQuery, changes: QueryChanges) {
    return Object.entries(changes).some(
        ([name, value]) =>
            JSON.stringify(queryValues(query[name])) !==
            JSON.stringify(queryValues(value))
    );
}

/** Every value of a parameter, which may be absent, given once or repeated */
function queryValues(value: string | string[] | undefined): string[] {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** A parameter given exactly once, or undefined when absent, empty or repeated */
function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" && value !== "" ? value : undefined;
}

/** One of the allowed values, or undefined when the parameter names none of them */
function oneOf<T extends string>(
    value: string | string[] | undefined,
    allowed: readonly T[]
): T | undefined {
    const single = singleValue(value);
    return allowed.find((candidate) => candidate === single);
}

/** The sort the query names, or undefined when it names none or one that does not exist */
export function parseSortParam<S extends string>(
    query: ParsedUrlQuery,
    sorts: readonly S[]
): S | undefined {
    return oneOf(query.sort, sorts);
}

/**
 * The `tags` parameter, repeated once per tag. Empty values are dropped, and
 * tags differing only in case (tags are case-insensitive) count once.
 */
export function parseTagsParam(query: ParsedUrlQuery): string[] {
    const seen = new Set<string>();
    return queryValues(query.tags).filter((tag) => {
        const key = tag.toLowerCase();
        if (tag.trim() === "" || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** The `tags` parameter for the tags; none leaves it out */
export function tagsParam(tags: string[]): QueryChanges {
    return { tags: tags.length > 0 ? tags : undefined };
}

/** The `sort` parameter for a sort: left out when there is none to show */
export function sortParam<S extends string>(sort: S | undefined): QueryChanges {
    return { sort };
}

/** The Collections tab's filter that the query names; anything missing or not valid is its default */
export function parseCollectionsFilter(
    query: ParsedUrlQuery
): CollectionsFilter {
    return {
        tags: parseTagsParam(query),
        fileType:
            oneOf<CollectionFileType>(query.fileType, COLLECTION_FILE_TYPES) ??
            NO_COLLECTIONS_FILTER.fileType,
        forgotten: singleValue(query.forgotten) === "true",
        // As typed, so a pause after a space keeps it; the search trims it
        q: singleValue(query.q)?.trim() ? (query.q as string) : ""
    };
}

/** The Collections tab's filter parameters, leaving out those at their default */
export function collectionsFilterParams(
    filter: CollectionsFilter
): QueryChanges {
    return {
        ...tagsParam(filter.tags),
        fileType:
            filter.fileType !== NO_COLLECTIONS_FILTER.fileType
                ? filter.fileType
                : undefined,
        forgotten: filter.forgotten ? "true" : undefined,
        q: filter.q.trim() ? filter.q : undefined
    };
}

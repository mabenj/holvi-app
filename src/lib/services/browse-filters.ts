import { InvalidArgumentError } from "../common/errors";
import { TAG_MAX_LENGTH } from "../types/tag-count";

/** Filters shared by the browsing services, as SQL conditions for a WHERE clause */

/** SQL conditions, each starting with AND, and the named values they use */
export interface SqlFilter {
    conditions: string;
    replacements: Record<string, unknown>;
}

/** At most this many tags in one filter */
export const MAX_FILTER_TAGS = 20;

/** Where the tags of the browsed rows are stored */
interface TagJunction {
    /** The junction table, e.g. "CollectionTags" */
    table: string;
    /** Its column naming the tagged row */
    ownerColumn: string;
    /** The browsed row's id in the outer query */
    owner: string;
}

/**
 * Matches rows that have every one of the tags. With several junctions, a row
 * has a tag if any of them holds it, e.g. a file or its collection. Tags
 * compare ignoring case, since tag names are case-insensitive.
 */
export function tagFilter(
    tags: string[] | undefined,
    junctions: TagJunction | TagJunction[]
): SqlFilter {
    const names = tags ?? [];
    if (names.length > MAX_FILTER_TAGS) {
        throw new InvalidArgumentError(
            `Filter by at most ${MAX_FILTER_TAGS} tags`
        );
    }
    if (names.some((name) => !name || name.length > TAG_MAX_LENGTH)) {
        throw new InvalidArgumentError("Malformed tag");
    }
    const holders = [junctions].flat();
    const replacements: Record<string, unknown> = {};
    const conditions = names.map((name, i) => {
        replacements[`filterTag${i}`] = name;
        const held = holders.map(
            ({ table, ownerColumn, owner }) =>
                `EXISTS (SELECT 1 FROM ${table} t
                    WHERE t.${ownerColumn} = ${owner}
                    AND t."TagName" = CAST(:filterTag${i} AS citext))`
        );
        return `AND (${held.join(" OR ")})`;
    });
    return { conditions: conditions.join("\n"), replacements };
}

/** Every one of the filters at once */
export function allOf(filters: SqlFilter[]): SqlFilter {
    return {
        conditions: filters.map((filter) => filter.conditions).join("\n"),
        replacements: Object.assign(
            {},
            ...filters.map((filter) => filter.replacements)
        )
    };
}

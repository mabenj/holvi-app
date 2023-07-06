import { CollectionDto } from "../interfaces/collection-dto";
import { CollectionFileDto } from "../interfaces/collection-file-dto";
import { CollectionGridItem, ItemType } from "../interfaces/collection-grid-item";

const FORMATTER = new Intl.RelativeTimeFormat("en", {
    localeMatcher: "best fit",
    numeric: "auto",
    style: "long"
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const DIVISIONS = [
    { amount: 60, name: "seconds" },
    { amount: 60, name: "minutes" },
    { amount: 24, name: "hours" },
    { amount: 7, name: "days" },
    { amount: 4.34524, name: "weeks" },
    { amount: 12, name: "months" },
    { amount: Number.POSITIVE_INFINITY, name: "years" }
];

export const EMPTY_UUIDV4 = "00000000-0000-0000-0000-000000000000";

export function isUuidv4(uuid: string) {
    return /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
        uuid
    );
}

export function timeAgo(date: Date) {
    if (!date) {
        return undefined;
    }
    let duration = (date.getTime() - new Date().getTime()) / 1000;

    for (let i = 0; i < DIVISIONS.length; i++) {
        const division = DIVISIONS[i];
        if (Math.abs(duration) < division.amount) {
            return FORMATTER.format(
                Math.round(duration),
                division.name as Intl.RelativeTimeFormatUnit
            );
        }
        duration /= division.amount;
    }
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error || error instanceof ErrorEvent)
        return error.message;
    const str = String(error);
    return str === "Undefined" ? "Unknown error" : str;
}

export function prettyNumber(number: number | undefined) {
    if (typeof number === "undefined") {
        return "";
    }
    return NUMBER_FORMATTER.format(number);
}

/**
 * Must be at least 8 characters long, contains an uppercase character, an lowercase character, and a number.
 */
export function isValidPassword(password: string) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    return (
        password.length >= minLength &&
        hasUppercase &&
        hasLowercase &&
        hasNumber
    );
}

/**
 * Must be between 3 and 20 characters long and contain alphanumeric symbols.
 */
export function isValidUsername(username: string) {
    const minLength = 3;
    const maxLength = 20;
    const charactersAllowed = /^[a-zA-Z0-9_]+$/.test(username);
    return (
        username.length >= minLength &&
        username.length <= maxLength &&
        charactersAllowed
    );
}

export function caseInsensitiveSorter<T, K extends keyof T>(
    key: K,
    asc: boolean = true
): (a: T, b: T) => number {
    return (a: T, b: T) => {
        const valueA = String(a[key]).toLowerCase();
        const valueB = String(b[key]).toLowerCase();

        const result = valueA.localeCompare(valueB, undefined, {
            sensitivity: "accent"
        });
        return asc ? result : -result;
    };
}

export function filesToGridItems(files: CollectionFileDto[]): CollectionGridItem[] {
    return files
        .map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType.includes("video")
                ? "video"
                : ("image" as ItemType),
            tags: [], // TODO
            timestamp: new Date(file.createdAt),
            src: file.src,
            width: file.width,
            height: file.height,
            thumbnailSrc: file.thumbnailSrc,
            thumbnailWidth: file.thumbnailWidth,
            thumbnailHeight: file.thumbnailHeight
        }))
        .sort(caseInsensitiveSorter("name"));
}

export function collectionsToGridItems(
    collections: CollectionDto[]
): CollectionGridItem[] {
    return collections
        .map((collection) => ({
            id: collection.id,
            name: collection.name,
            type: "collection" as ItemType,
            tags: collection.tags,
            timestamp: new Date(collection.createdAt)
        }))
        .sort(caseInsensitiveSorter("name"));
}

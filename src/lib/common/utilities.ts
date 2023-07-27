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

export function isUuidv4(uuid?: string) {
    if(!uuid){
        return false;
    }
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

export function getFileSrc(options: {
    collectionId: string;
    fileId: string;
    mimeType: string;
    thumbnail?: boolean;
}) {
    const { collectionId, fileId, mimeType, thumbnail = false } = options;
    const isImage = mimeType.includes("image");
    return `/api/collections/${collectionId}/files?${
        thumbnail ? "thumbnail" : isImage ? "image" : "video"
    }=${fileId}`;
}

export function launchFullscreen(element: any) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

export function formatDate(date: Date | number) {
    if (typeof date === "number") {
        date = new Date(date);
    }
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

export function isValidDate(d: any) {
    return !isNaN(d) && d instanceof Date;
  }

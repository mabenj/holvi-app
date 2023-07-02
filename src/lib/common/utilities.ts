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
    return str === "Undefined" ? undefined : str;
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
    key: K
): (a: T, b: T) => number {
    return (a: T, b: T) => {
        const valueA = String(a[key]).toLowerCase();
        const valueB = String(b[key]).toLowerCase();

        return valueA.localeCompare(valueB, undefined, {
            sensitivity: "accent"
        });
    };
}

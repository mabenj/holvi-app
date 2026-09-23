import { InvalidArgumentError } from "./errors";

/** A query parameter given at most once, or undefined when absent or empty */
export function singleQueryParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        throw new InvalidArgumentError("Repeated query parameter");
    }
    return value || undefined;
}

/** A query parameter that can be repeated, e.g. ?tags=a&tags=b; empty values are dropped */
export function listQueryParam(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.filter((item) => item !== "");
}

/** A numeric query parameter; the service checks its range */
export function numberQueryParam(value: string | string[] | undefined) {
    const single = singleQueryParam(value);
    return single === undefined ? undefined : Number(single);
}

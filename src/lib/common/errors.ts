export class UnauthorizedError extends Error {}

export class NotFoundError extends Error {}

export class InvalidArgumentError extends Error {}

export class RangeNotSatisfiableError extends RangeError {
    constructor(message: string, readonly totalSize: number) {
        super(message);
        this.name = "RangeNotSatisfiableError";
    }
}

export class HolviError extends Error {
    constructor(message: string, readonly inner?: unknown) {
        super(message);
        this.name = "HolviError";
    }
}

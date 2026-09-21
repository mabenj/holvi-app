/** Tells the current time. Services take one so tests can control time. */
export type Clock = () => Date;

export const realClock: Clock = () => new Date();

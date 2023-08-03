// https://ghaiklor.github.io/type-challenges-solutions/en/medium-deep-readonly.html

export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends Record<string, unknown>
        ? DeepReadonly<T[P]>
        : T[P];
};

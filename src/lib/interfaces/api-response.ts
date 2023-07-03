export type ApiResponse<T = {}> = {
    status: "ok" | "error";
    error?: string;
} & T;

export type ApiResponse<T = {}> = SuccessResponse<T> | ErrorResponse<T>;

type SuccessResponse<T> = {
    status: "ok";
} & T;

type ErrorResponse<T> = {
    status: "error";
    error: string;
} & T;

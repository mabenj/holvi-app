import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
    HolviError,
    InvalidArgumentError,
    NotFoundError,
    UnauthorizedError
} from "./errors";
import Log, { LogColor } from "./log";
import { withUser, withoutUser } from "./route-helpers";
import { getErrorMessage } from "./utilities";

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    DELETE = "DELETE",
    PUT = "PUT"
}

type ApiHandler = (
    req: ApiRequest,
    res: ApiResponse
) => unknown | Promise<unknown>;

export type ApiRequest<T = any> = Omit<NextApiRequest, "body"> & { body: T };

export type ApiResponse<T = {}> = NextApiResponse<ApiData<T>>;

export type ApiData<T = {}> = SuccessData<T> | ErrorData<T>;

type SuccessData<T> = {
    status: "ok";
} & T;

type ErrorData<T> = {
    status: "error";
    error: string;
} & T;

interface ApiHandlerOptions {
    handler: ApiHandler;
    validator?: z.ZodType;
    /**
     * Default: true
     */
    authenticate?: boolean;
}

interface ApiRouteOptions {
    get?: ApiHandlerOptions | ApiHandler;
    post?: ApiHandlerOptions | ApiHandler;
    delete?: ApiHandlerOptions | ApiHandler;
    put?: ApiHandlerOptions | ApiHandler;
}

export class ApiRoute {
    private static readonly logger = new Log("API", LogColor.MAGENTA);

    static create(options: ApiRouteOptions): NextApiHandler {
        const {
            get: getParams,
            post: postParams,
            delete: deleteParams,
            put: putParams
        } = options;
        const getOptions =
            typeof getParams === "function"
                ? { handler: getParams }
                : getParams;
        const postOptions =
            typeof postParams === "function"
                ? { handler: postParams }
                : postParams;
        const deleteOptions =
            typeof deleteParams === "function"
                ? { handler: deleteParams }
                : deleteParams;
        const putOptions =
            typeof putParams === "function"
                ? { handler: putParams }
                : putParams;

        const handle: NextApiHandler = async (req, res) => {
            ApiRoute.logger.info(`${req.method}: ${req.url}`);

            let authenticate = true;
            let handler: ApiHandler | undefined;
            let validator: z.ZodType | undefined;

            switch (req.method) {
                case HttpMethod.GET:
                    authenticate = getOptions?.authenticate ?? true;
                    handler = getOptions?.handler;
                    validator = getOptions?.validator;
                    break;
                case HttpMethod.POST:
                    authenticate = postOptions?.authenticate ?? true;
                    handler = postOptions?.handler;
                    validator = postOptions?.validator;
                    break;
                case HttpMethod.DELETE:
                    authenticate = deleteOptions?.authenticate ?? true;
                    handler = deleteOptions?.handler;
                    validator = deleteOptions?.validator;
                    break;
                case HttpMethod.PUT:
                    authenticate = putOptions?.authenticate ?? true;
                    handler = putOptions?.handler;
                    validator = putOptions?.validator;
                    break;
                default:
                // nothing
            }

            if (typeof handler !== "function") {
                res.status(405).end();
                return;
            }

            handler = authenticate ? withUser(handler) : withoutUser(handler);

            if (validator) {
                const parsed = validator.safeParse(JSON.parse(req.body));
                if (!parsed.success) {
                    const errors = parsed.error.flatten();
                    res.status(400).json({
                        status: "error",
                        error: "Malformed request body",
                        errors
                    });
                    return;
                }
                req.body = parsed.data;
            }

            try {
                await handler(req, res);
            } catch (error) {
                let code = 500;
                let message = "Internal server error";
                if (error instanceof NotFoundError) {
                    code = 404;
                    message = getMessage(error, "Not found");
                } else if (error instanceof InvalidArgumentError) {
                    code = 400;
                    message = getMessage(error, "Invalid request");
                } else if (error instanceof UnauthorizedError) {
                    code = 401;
                    message = getMessage(error, "Unauthorized");
                } else if (error instanceof HolviError) {
                    ApiRoute.logger.error(
                        `HolviError ${req.method} ${req.url} (${error.message})`,
                        error.inner
                    );
                } else {
                    ApiRoute.logger.error(
                        `Unexpected error ${req.method} ${
                            req.url
                        } (${getErrorMessage(error)})`,
                        error
                    );
                }
                res.status(code).json({
                    status: "error",
                    error: message
                });
            }
        };

        return handle;
    }
}

function getMessage(error: Error, baseMsg: string) {
    return `${baseMsg}${error.message ? ` (${error.message})` : ""}`;
}

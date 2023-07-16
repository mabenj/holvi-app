import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import Log from "./log";
import { withUser, withoutUser } from "./route-helpers";

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

export type ApiResponse<T = {}> = NextApiResponse<
    SuccessResponse<T> | ErrorResponse<T>
>;

type SuccessResponse<T> = {
    status: "ok";
} & T;

type ErrorResponse<T> = {
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
            Log.info(`${req.method}: ${req.url}`);

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
                Log.error(
                    `Error handling ${req.method} method to ${req.url}`,
                    error
                );
                res.status(500).json({
                    status: "error",
                    error: "Internal server error"
                });
            }
        };

        return handle;
    }
}

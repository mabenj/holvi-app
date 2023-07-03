import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import Log from "./log";
import { withUser, withoutUser } from "./route-helpers";

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    DELETE = "DELETE",
    PUT = "PUT"
}

interface ApiRouteOptions {
    authenticate?: boolean;
    get?: NextApiHandler;
    post?: NextApiHandler;
    delete?: NextApiHandler;
    put?: NextApiHandler;
}

export class ApiRoute {
    static create(options: ApiRouteOptions) {
        const {
            authenticate = true,
            get: getHandler,
            post: postHandler,
            delete: deleteHandler,
            put: putHandler
        } = options;

        const handle = (req: NextApiRequest, res: NextApiResponse) => {
            Log.info(`${req.method}: ${req.url}`);
            try {
                switch (req.method) {
                    case HttpMethod.GET: {
                        if (typeof getHandler !== "function") {
                            break;
                        }
                        return getHandler(req, res);
                    }
                    case HttpMethod.POST: {
                        if (typeof postHandler !== "function") {
                            break;
                        }
                        return postHandler(req, res);
                    }
                    case HttpMethod.DELETE: {
                        if (typeof deleteHandler !== "function") {
                            break;
                        }
                        return deleteHandler(req, res);
                    }
                    case HttpMethod.PUT: {
                        if (typeof putHandler !== "function") {
                            break;
                        }
                        return putHandler(req, res);
                    }
                    default:
                    // nothing
                }
                res.status(405).end();
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

        if (authenticate) {
            return withUser(handle);
        }
        return withoutUser(handle);
    }
}

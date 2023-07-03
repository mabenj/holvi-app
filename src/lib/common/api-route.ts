import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import Log from "./log";
import { withUser, withoutUser } from "./route-helpers";

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    DELETE = "DELETE",
    PUT = "PUT"
}

export class ApiRoute {
    static get(handler: NextApiHandler, authenticate: boolean = true) {
        return this.withMethod(HttpMethod.GET, authenticate, handler);
    }

    static post(handler: NextApiHandler, authenticate: boolean = true) {
        return this.withMethod(HttpMethod.POST, authenticate, handler);
    }

    static delete(handler: NextApiHandler, authenticate: boolean = true) {
        return this.withMethod(HttpMethod.DELETE, authenticate, handler);
    }

    static put(handler: NextApiHandler, authenticate: boolean = true) {
        return this.withMethod(HttpMethod.PUT, authenticate, handler);
    }

    private static withMethod(
        method: HttpMethod,
        authenticate: boolean,
        handler: NextApiHandler
    ) {
        const checkMethod = (req: NextApiRequest, res: NextApiResponse) => {
            Log.info(`${method}: ${req.url}`);
            if (req.method !== method) {
                res.status(405).end();
                return;
            }
            return handler(req, res);
        };
        if (authenticate) {
            return withUser(checkMethod);
        }
        return withoutUser(checkMethod);
    }
}

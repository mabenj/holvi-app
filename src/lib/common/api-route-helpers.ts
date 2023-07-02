import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import AuthService from "../services/auth.service";
import { withSessionRoute } from "./iron-session";

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    DELETE = "DELETE",
    PUT = "PUT"
}

export function withUser(handler: NextApiHandler) {
    return withSessionRoute(async (req, res) => {
        const user = await AuthService.validateUser(req.session);
        if (!user) {
            res.status(401).end();
            return;
        }

        return handler(req, res);
    });
}

/**
 * Redirects to '/' if there is a session with a valid user going on
 */
export function withoutUser(handler: NextApiHandler) {
    return withSessionRoute(async (req, res) => {
        const user = await AuthService.validateUser(req.session);
        if (user) {
            res.redirect("/").end();
            return;
        }

        return handler(req, res);
    });
}

export function withGet(handler: NextApiHandler) {
    return withMethod(HttpMethod.GET, handler);
}

export function withPost(handler: NextApiHandler) {
    return withMethod(HttpMethod.POST, handler);
}

export function withDelete(handler: NextApiHandler) {
    return withMethod(HttpMethod.DELETE, handler);
}

export function withPut(handler: NextApiHandler) {
    return withMethod(HttpMethod.PUT, handler);
}

function withMethod(method: HttpMethod, handler: NextApiHandler) {
    return (req: NextApiRequest, res: NextApiResponse) => {
        if (req.method !== method) {
            res.status(404).end();
            return;
        }
        return handler(req, res);
    };
}

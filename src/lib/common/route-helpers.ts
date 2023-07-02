import {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
    NextApiHandler,
    NextApiRequest,
    NextApiResponse
} from "next";
import AuthService from "../services/auth.service";
import { withSessionRoute, withSessionSsr } from "./iron-session";
import Log from "./log";

enum HttpMethod {
    GET = "GET",
    POST = "POST",
    DELETE = "DELETE",
    PUT = "PUT"
}

export function withUserSsr<
    P extends { [key: string]: unknown } = { [key: string]: unknown }
>(
    handler: (
        context: GetServerSidePropsContext
    ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
    return withSessionSsr(async (context) => {
        const user = await AuthService.validateUser(context.req.session);
        if (!user) {
            return {
                redirect: {
                    destination: "/login",
                    statusCode: 401,
                    permanent: false
                }
            };
        }
        context.req.session.user = user;
        await context.req.session.save();
        return handler(context);
    });
}

export function withUser(handler: NextApiHandler) {
    return withSessionRoute(async (req, res) => {
        const user = await AuthService.validateUser(req.session);
        if (!user) {
            res.status(401).end();
            return;
        }
        req.session.user = user;
        await req.session.save();
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
        Log.info(`${method}: ${req.url}`);
        if (req.method !== method) {
            res.status(404).end();
            return;
        }
        return handler(req, res);
    };
}

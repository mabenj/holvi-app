import {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
    NextApiHandler
} from "next";
import AuthService from "../services/auth.service";
import { withSessionRoute, withSessionSsr } from "./iron-session";

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

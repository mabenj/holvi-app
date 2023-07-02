import { User } from "@/lib/interfaces/user";
import { IronSessionOptions } from "iron-session";
import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
    NextApiHandler
} from "next";
import { sessionOptions } from "./session-options";



export function withSessionRoute(handler: NextApiHandler) {
    return withIronSessionApiRoute(handler, sessionOptions);
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
    P extends { [key: string]: unknown } = { [key: string]: unknown }
>(
    handler: (
        context: GetServerSidePropsContext
    ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
    return withIronSessionSsr(handler, sessionOptions);
}

declare module "iron-session" {
    interface IronSessionData {
        user: User;
    }
}

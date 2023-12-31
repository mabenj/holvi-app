import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
    NextApiHandler
} from "next";
import { UserDto } from "../types/user-dto";
import appConfig from "./app-config";

export function withSessionRoute(handler: NextApiHandler) {
    return withIronSessionApiRoute(handler, appConfig.sessionOptions);
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
    P extends { [key: string]: unknown } = { [key: string]: unknown }
>(
    handler: (
        context: GetServerSidePropsContext
    ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
    return withIronSessionSsr(handler, appConfig.sessionOptions);
}

declare module "iron-session" {
    interface IronSessionData {
        user: UserDto;
    }
}

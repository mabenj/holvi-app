import { getIronSession } from "iron-session/edge";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import appConfig from "./lib/common/app-config";

/** Screens reachable without a session; a signed-in user is sent home from them */
const AUTH_PATHS = ["/login", "/signup"];

export const middleware = async (req: NextRequest) => {
    const res = NextResponse.next();
    const session = await getIronSession(req, res, appConfig.sessionOptions);
    const { user } = session;
    const isAuthPath = AUTH_PATHS.includes(req.nextUrl.pathname.toLowerCase());

    if (!user && !isAuthPath) {
        return NextResponse.redirect(new URL("/login", req.url));
    }
    if (user && isAuthPath) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    return res;
};

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * and except public files such as the web app manifest and icons, which
         * the sign-in screen and home-screen install need without a session
         */
        "/((?!api|_next/static|_next/image|.*\.(?:ico|png|svg|xml|webmanifest)$).*)"
    ]
};

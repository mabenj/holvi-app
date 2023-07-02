// /middleware.ts
import { getIronSession } from "iron-session/edge";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sessionOptions } from "./lib/common/session-options";

export const middleware = async (req: NextRequest) => {
    const res = NextResponse.next();
    const session = await getIronSession(req, res, sessionOptions);
    const { user } = session;
    const nextUrl = req.nextUrl.pathname.toLowerCase();

    if (!user && nextUrl !== "/login") {
        return NextResponse.redirect(new URL("/login", req.url));
    }
    if (user && nextUrl === "/login") {
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
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)"
    ]
};

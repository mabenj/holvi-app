import { ApiRoute } from "@/lib/common/api-route";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface ResponseData {
    status: "ok" | "error";
    usernameError?: string;
    passwordError?: string;
    serverError?: string;
}

async function post(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    const { username, password } = JSON.parse(req.body);
    const { usernameError, passwordError, user } =
        await AuthService.registerUser(username, password);
    if (!user || usernameError || passwordError) {
        res.status(400).json({
            status: "error",
            usernameError,
            passwordError
        });
        return;
    }

    req.session.user = user;
    await req.session.save();
    res.status(201).json({ status: "ok" });
}

export default ApiRoute.create({ authenticate: false, post });

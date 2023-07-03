import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface Result {
    usernameError?: string;
    passwordError?: string;
}

async function post(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<Result>>
) {
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

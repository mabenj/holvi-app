import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import { SignUpResponse } from "@/lib/interfaces/sign-up-response";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

async function post(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse<SignUpResponse>>
) {
    const data = JSON.parse(req.body);
    const { usernameError, passwordError, user } =
        await AuthService.registerUser(data);
    if (!user || usernameError || passwordError) {
        res.status(400).json({
            status: "error",
            error: "Error signing up",
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

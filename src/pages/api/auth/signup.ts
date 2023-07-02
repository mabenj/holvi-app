import { ApiRoute } from "@/lib/common/api-route";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

interface ResponseData {
    status: "ok" | "error";
    usernameError?: string;
    passwordError?: string;
    serverError?: string;
}

export default ApiRoute.post(handler, false);

async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    const { username, password } = JSON.parse(req.body);
    try {
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
    } catch (error) {
        res.status(500).json({
            status: "error",
            serverError: JSON.stringify(error)
        });
    }
}

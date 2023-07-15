import { ApiRoute } from "@/lib/common/api-route";
import { ApiResponse } from "@/lib/interfaces/api-response";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

async function post(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
    const { username, password } = JSON.parse(req.body);
    const user =
        username && password
            ? await AuthService.loginUser(username, password)
            : null;
    if (!user) {
        res.status(401).json({
            status: "error",
            error: "Username doesn't exist or the password is incorrect"
        });
        return;
    }

    req.session.user = user;
    await req.session.save();
    res.status(200).json({ status: "ok" });
}

export default ApiRoute.create({ authenticate: false, post });

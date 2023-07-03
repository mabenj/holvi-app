import { ApiRoute } from "@/lib/common/api-route";
import AuthService from "@/lib/services/auth.service";
import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData = {
    status: "ok" | "error";
    error?: string;
};

export default ApiRoute.create({ authenticate: false, post });

async function post(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
    const { username, password } = JSON.parse(req.body);
    const user =
        username && password
            ? await AuthService.loginUser(username, password)
            : null;
    if (!user) {
        res.status(401).json({
            status: "error",
            error: "Username doesn't exist or the password is wrong"
        });
        return;
    }

    req.session.user = user;
    await req.session.save();
    res.status(200).json({ status: "ok" });
}

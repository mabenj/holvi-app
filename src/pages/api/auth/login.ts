import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import AuthService from "@/lib/services/auth.service";
import {
    LoginFormData,
    LoginValidator
} from "@/lib/validators/login-validator";

async function post(req: ApiRequest<LoginFormData>, res: ApiResponse) {
    const { username, password } = req.body;
    const user = await AuthService.loginUser(username, password);
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

export default ApiRoute.create({
    post: {
        handler: post,
        authenticate: false,
        validator: LoginValidator
    }
});

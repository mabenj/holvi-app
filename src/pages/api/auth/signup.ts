import { ApiRequest, ApiResponse, ApiRoute } from "@/lib/common/api-route";
import { SignUpResponse } from "@/lib/interfaces/sign-up-response";
import AuthService from "@/lib/services/auth.service";
import {
    SignUpFormData,
    SignUpValidator
} from "@/lib/validators/sign-up-validator";

async function post(
    req: ApiRequest<SignUpFormData>,
    res: ApiResponse<SignUpResponse>
) {
    const { usernameError, passwordError, user } =
        await AuthService.registerUser(req.body.username, req.body.password);
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

export default ApiRoute.create({
    post: {
        handler: post,
        authenticate: false,
        validator: SignUpValidator
    }
});

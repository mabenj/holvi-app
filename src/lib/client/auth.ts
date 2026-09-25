import { LoginFormData } from "../validators/login.validator";
import { SignUpFormData } from "../validators/sign-up.validator";

export class SignUpError extends Error {
    constructor(
        readonly usernameError?: string,
        readonly passwordError?: string
    ) {
        super(usernameError || passwordError || "Error signing up");
    }
}

// The API routes parse the raw body themselves, so the request must not carry a
// JSON content type: Next.js would parse it first and the route would parse twice.
async function post(url: string, payload?: unknown) {
    const res = await fetch(url, {
        method: "POST",
        body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}

export async function signIn(formData: LoginFormData) {
    const { ok, data } = await post("/api/auth/login", formData);
    if (!ok) {
        throw new Error(data.error || "Could not sign in");
    }
}

export async function signUp(formData: SignUpFormData) {
    const { ok, data } = await post("/api/auth/signup", formData);
    if (!ok) {
        throw new SignUpError(data.usernameError, data.passwordError);
    }
}

export async function signOut() {
    const { ok, data } = await post("/api/auth/logout");
    if (!ok) {
        throw new Error(data.error || "Could not sign out");
    }
}

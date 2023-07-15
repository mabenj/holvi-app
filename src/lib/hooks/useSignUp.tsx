import { useRouter } from "next/router";
import { useState } from "react";
import { isValidPassword, isValidUsername } from "../common/utilities";

export function useSignUp() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");

    const [usernameError, setUsernameError] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();

    const signUp = async () => {
        const passwordValid = isValidPassword(password);
        const usernameValid = isValidUsername(username);
        const passwordsMatch = password === password2;
        if (!passwordsMatch) {
            setPasswordError("Passwords do not match");
        }
        if (!usernameValid) {
            setUsernameError(
                "Must be between 3 and 20 characters long and contain only allowed characters"
            );
        }
        if (!passwordValid) {
            setPasswordError(
                "Must be at least 8 characters long, contain lower and uppercase characters, and a number"
            );
        }
        if (!passwordValid || !usernameValid || !passwordsMatch) {
            return Promise.reject();
        }

        setIsLoading(true);
        const response = await fetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        setIsLoading(false);

        const data = await response.json();
        setUsernameError(data.usernameError || "");
        setPasswordError(data.PasswordError || "");

        if (data.status === "error") {
            return Promise.reject(data.serverError);
        }

        await router.push("/");
        return Promise.resolve();
    };

    const handleUsernameChange = (value: string) => {
        setUsernameError("");
        setUsername(value);
    };

    const handlePasswordChange = (value: string) => {
        setPasswordError("");
        setPassword(value);
    };

    const handlePasswordChange2 = (value: string) => {
        setPasswordError("");
        setPassword2(value);
    };

    return {
        username,
        setUsername: handleUsernameChange,
        password,
        setPassword: handlePasswordChange,
        password2,
        setPassword2: handlePasswordChange2,
        usernameError,
        passwordError,
        isLoading,
        signUp
    };
}

import { useRouter } from "next/router";
import { useState } from "react";

export function useLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { push } = useRouter();

    const login = async () => {
        if (!username || !password) {
            setError("Invalid username or password");
            return Promise.reject();
        }

        setIsLoggingIn(true);
        const response = await fetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        setError(data.error || "");
        setIsLoggingIn(false);
        if (data.status === "error") {
            return Promise.reject();
        }

        push("/");
        return Promise.resolve();
    };

    const logout = async () => {
        setIsSigningOut(true);
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST"
            });
            if (response.status !== 200) {
                throw new Error();
            }
            push("/login");
            return Promise.resolve();
        } catch {
            return Promise.reject("Could not sign out");
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleUsernameChange = (value: string) => {
        setError("");
        setUsername(value);
    };

    const handlePasswordChange = (value: string) => {
        setError("");
        setPassword(value);
    };

    return {
        username,
        setUsername: handleUsernameChange,
        password,
        setPassword: handlePasswordChange,
        error,
        isLoggingIn,
        isSigningOut,
        login,
        logout
    };
}

import { useToast } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { ApiData } from "../common/api-route";
import { getErrorMessage } from "../common/utilities";
import { SignUpResponse } from "../types/sign-up-response";
import { LoginFormData } from "../validators/login.validator";
import { SignUpFormData } from "../validators/sign-up.validator";
import { useHttp } from "./useHttp";

export function useAuth() {
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);

    const http = useHttp();
    const toast = useToast();
    const router = useRouter();

    const signIn = async (formData: LoginFormData) => {
        setIsSigningIn(true);
        const { error, statusCode } = await http
            .post("/api/auth/login", { payload: formData })
            .catch((error) => {
                setIsSigningIn(false);
                throw error;
            });
        if (error || statusCode !== 200) {
            setIsSigningIn(false);
            return Promise.reject(error);
        }
        await router.push("/");
        toast({
            description: "Successfully signed in",
            status: "success"
        });
        setIsSigningIn(false);
    };

    const signOut = async () => {
        setIsSigningOut(true);
        const { error } = await http.post("/api/auth/logout").catch((error) => {
            setIsSigningOut(false);
            throw error;
        });
        if (error) {
            toast({
                description: `Error signing out: ${getErrorMessage(error)}`,
                status: "error"
            });
        } else {
            await router.push("/login");
            toast({
                description: "You have been signed out",
                status: "info"
            });
        }
        setIsSigningOut(false);
    };

    const signUp = async (formData: SignUpFormData) => {
        setIsSigningUp(true);
        const { data, error } = await http
            .post<ApiData<SignUpResponse>>("/api/auth/signup", {
                payload: formData
            })
            .catch((error) => {
                setIsSigningUp(false);
                throw error;
            });
        if (data?.status === "ok" && !error) {
            await router.push("/");
            toast({
                description: "Successfully singed up",
                status: "success"
            });
            return;
        }
        
        setIsSigningUp(false);
        return Promise.reject({
            usernameError: data?.usernameError,
            passwordError: data?.passwordError
        })
    };

    return { isSigningIn, isSigningOut, isSigningUp, signIn, signOut, signUp };
}

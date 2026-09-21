import { signIn } from "@/lib/client/auth";
import { getErrorMessage } from "@/lib/common/utilities";
import AuthLayout from "@/lib/components/auth/AuthLayout";
import {
    LoginFormData,
    LoginValidator
} from "@/lib/validators/login.validator";
import { Button, Field, Input, Link, Stack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function SignIn() {
    const router = useRouter();
    const [error, setError] = useState<string>();
    const {
        register,
        handleSubmit,
        formState: { isSubmitting }
    } = useForm<LoginFormData>({ resolver: zodResolver(LoginValidator) });

    const onSubmit = async (formData: LoginFormData) => {
        setError(undefined);
        try {
            await signIn(formData);
            await router.replace("/");
        } catch (error) {
            setError(getErrorMessage(error));
        }
    };

    return (
        <AuthLayout
            title="Sign in"
            subtitle="Welcome back to your vault."
            footer={
                <>
                    New to Holvi?{" "}
                    <Link asChild colorPalette="blue" fontWeight="medium">
                        <NextLink href="/signup">Create an account</NextLink>
                    </Link>
                </>
            }>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack gap="4">
                    <Field.Root required invalid={!!error}>
                        <Field.Label>Username</Field.Label>
                        <Input
                            size="lg"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            {...register("username")}
                        />
                    </Field.Root>
                    <Field.Root required invalid={!!error}>
                        <Field.Label>Password</Field.Label>
                        <Input
                            size="lg"
                            type="password"
                            autoComplete="current-password"
                            {...register("password")}
                        />
                        <Field.ErrorText>{error}</Field.ErrorText>
                    </Field.Root>
                    <Button type="submit" size="lg" mt="2" loading={isSubmitting}>
                        Sign in
                    </Button>
                </Stack>
            </form>
        </AuthLayout>
    );
}

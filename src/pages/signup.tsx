import { signUp, SignUpError } from "@/lib/client/auth";
import { getErrorMessage } from "@/lib/common/utilities";
import AuthLayout from "@/lib/components/auth/AuthLayout";
import {
    SignUpFormData,
    SignUpValidator
} from "@/lib/validators/sign-up.validator";
import { Button, Field, Input, Link, Stack, Text } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function SignUp() {
    const router = useRouter();
    const [error, setError] = useState<string>();
    const {
        register,
        handleSubmit,
        setError: setFieldError,
        formState: { errors, isSubmitting }
    } = useForm<SignUpFormData>({ resolver: zodResolver(SignUpValidator) });

    const onSubmit = async (formData: SignUpFormData) => {
        setError(undefined);
        try {
            await signUp(formData);
            await router.replace("/");
        } catch (error) {
            if (
                error instanceof SignUpError &&
                (error.usernameError || error.passwordError)
            ) {
                if (error.usernameError) {
                    setFieldError("username", { message: error.usernameError });
                }
                if (error.passwordError) {
                    setFieldError("password", { message: error.passwordError });
                }
                return;
            }
            setError(getErrorMessage(error));
        }
    };

    return (
        <AuthLayout
            title="Create an account"
            subtitle="Your photos and videos, encrypted on your own server."
            footer={
                <>
                    Already have an account?{" "}
                    <Link asChild colorPalette="blue" fontWeight="medium">
                        <NextLink href="/login">Sign in</NextLink>
                    </Link>
                </>
            }>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack gap="4">
                    <Field.Root required invalid={!!errors.username}>
                        <Field.Label>Username</Field.Label>
                        <Input
                            size="lg"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            {...register("username")}
                        />
                        <Field.HelperText>
                            Letters, numbers and underscores.
                        </Field.HelperText>
                        <Field.ErrorText>{errors.username?.message}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root required invalid={!!errors.password}>
                        <Field.Label>Password</Field.Label>
                        <Input
                            size="lg"
                            type="password"
                            autoComplete="new-password"
                            {...register("password")}
                        />
                        <Field.ErrorText>{errors.password?.message}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root required invalid={!!errors.confirmPassword}>
                        <Field.Label>Confirm password</Field.Label>
                        <Input
                            size="lg"
                            type="password"
                            autoComplete="new-password"
                            {...register("confirmPassword")}
                        />
                        <Field.ErrorText>
                            {errors.confirmPassword?.message}
                        </Field.ErrorText>
                    </Field.Root>
                    {error && (
                        <Text textStyle="sm" color="fg.error" role="alert">
                            {error}
                        </Text>
                    )}
                    <Button type="submit" size="lg" mt="2" loading={isSubmitting}>
                        Create account
                    </Button>
                </Stack>
            </form>
        </AuthLayout>
    );
}

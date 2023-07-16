import { ApiData } from "@/lib/common/api-route";
import { SignUpResponse } from "@/lib/interfaces/sign-up-response";
import {
    LoginFormData,
    LoginValidator
} from "@/lib/validators/login-validator";
import {
    SignUpFormData,
    SignUpValidator
} from "@/lib/validators/sign-up-validator";
import {
    Box,
    Button,
    Card,
    CardBody,
    Container,
    Divider,
    Flex,
    FormControl,
    FormErrorMessage,
    FormLabel,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    useDisclosure,
    useToast
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";

export default function Login() {
    return (
        <>
            <Head>
                <title>Holvi - Login</title>
                <meta name="description" content="Login to Holvi" />
            </Head>
            <main>
                <Container maxW="lg">
                    <Box py={10}></Box>
                    <LoginCard />
                </Container>
            </main>
        </>
    );
}

const LoginCard = () => {
    const [isLoading, setIsLoading] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<LoginFormData>({
        resolver: zodResolver(LoginValidator)
    });
    const toast = useToast();
    const router = useRouter();

    const onSubmit = async (formData: LoginFormData) => {
        setIsLoading(true);
        const data: ApiData = await fetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(formData)
        })
            .then((res) => res.json())
            .finally(() => setIsLoading(false));
        if (data.status === "error") {
            setError("username", { message: "" });
            setError("password", { message: data.error }); // show the message only below pwd field
            return;
        }
        await router.push("/");
        toast({
            description: "Successfully logged in",
            status: "success"
        });
    };

    return (
        <Card variant="outline">
            <CardBody>
                <Flex direction="column" gap={5}>
                    <form id="login-form" onSubmit={handleSubmit(onSubmit)}>
                        <Flex direction="column" gap={5}>
                            <FormControl isInvalid={!!errors.username}>
                                <Input
                                    isRequired
                                    type="text"
                                    placeholder="Username"
                                    variant="filled"
                                    {...register("username")}
                                />
                                <FormErrorMessage>
                                    {errors.username?.message}
                                </FormErrorMessage>
                            </FormControl>
                            <FormControl isInvalid={!!errors.password}>
                                <Input
                                    isRequired
                                    type="password"
                                    placeholder="Password"
                                    variant="filled"
                                    {...register("password")}
                                />
                                <FormErrorMessage>
                                    {errors.password?.message}
                                </FormErrorMessage>
                            </FormControl>

                            <Button
                                type="submit"
                                isLoading={isLoading}
                                form="login-form">
                                Login
                            </Button>
                        </Flex>
                    </form>
                    <Divider />
                    <SignUpModal />
                </Flex>
            </CardBody>
        </Card>
    );
};

const SignUpModal = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<SignUpFormData>({
        resolver: zodResolver(SignUpValidator)
    });
    const toast = useToast();
    const router = useRouter();

    const onSubmit = async (formData: SignUpFormData) => {
        setIsLoading(true);
        const data: ApiData<SignUpResponse> = await fetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify(formData)
        })
            .then((res) => res.json())
            .finally(() => setIsLoading(false));
        if (data.status === "ok") {
            return router.push("/").then(() =>
                toast({
                    description: "Successfully singed up",
                    status: "success"
                })
            );
        }
        data.usernameError &&
            setError("username", { message: data.usernameError });
        data.passwordError &&
            setError("password", { message: data.passwordError });
    };

    return (
        <>
            <Button type="button" onClick={onOpen} variant="ghost">
                Sign up
            </Button>

            <Modal isOpen={isOpen} onClose={onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Sign up</ModalHeader>
                    <ModalBody>
                        <form
                            id="sign-up-form"
                            onSubmit={handleSubmit(onSubmit)}>
                            <Flex direction="column" gap={5}>
                                <FormControl isInvalid={!!errors.username}>
                                    <FormLabel htmlFor="username">
                                        Username
                                    </FormLabel>
                                    <Input
                                        isRequired
                                        type="text"
                                        placeholder="Username"
                                        variant="filled"
                                        {...register("username")}
                                    />
                                    <FormErrorMessage>
                                        {errors.username?.message}
                                    </FormErrorMessage>
                                </FormControl>
                                <FormControl isInvalid={!!errors.password}>
                                    <FormLabel htmlFor="password">
                                        Password
                                    </FormLabel>
                                    <Input
                                        isRequired
                                        type="password"
                                        placeholder="Password"
                                        variant="filled"
                                        {...register("password")}
                                    />
                                    <FormErrorMessage>
                                        {errors.password?.message}
                                    </FormErrorMessage>
                                </FormControl>
                                <FormControl
                                    isInvalid={!!errors.confirmPassword}>
                                    <FormLabel htmlFor="confirmPassword">
                                        Confirm password
                                    </FormLabel>
                                    <Input
                                        isRequired
                                        type="password"
                                        placeholder="Password"
                                        variant="filled"
                                        {...register("confirmPassword")}
                                    />
                                    <FormErrorMessage>
                                        {errors.confirmPassword?.message}
                                    </FormErrorMessage>
                                </FormControl>
                            </Flex>
                        </form>
                    </ModalBody>

                    <ModalFooter>
                        <Button mr={3} onClick={onClose} variant="ghost">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="sign-up-form"
                            isLoading={isLoading}>
                            Sign up
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

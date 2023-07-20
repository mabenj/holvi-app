import { ApiData } from "@/lib/common/api-route";
import { getErrorMessage } from "@/lib/common/utilities";
import { useHttp } from "@/lib/hooks/useHttp";
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
    Button,
    Card,
    CardBody,
    Center,
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
                <title>Login</title>
                <meta name="description" content="Login to Holvi" />
            </Head>
            <main>
                <Container maxW="lg">
                    <Center w="100%" h="100dvh">
                        <LoginCard />
                    </Center>
                </Container>
            </main>
        </>
    );
}

const LoginCard = () => {
    const [isBusy, setIsBusy] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<LoginFormData>({
        resolver: zodResolver(LoginValidator)
    });
    const http = useHttp();
    const toast = useToast();
    const router = useRouter();

    const onSubmit = async (formData: LoginFormData) => {
        setIsBusy(true);
        const { error, statusCode } = await http.post(
            "/api/auth/login",
            formData
        );
        if (error || statusCode !== 200) {
            setError("username", { message: "" });
            // show the message only below pwd field
            setError("password", { message: getErrorMessage(error) });
            setIsBusy(false);
            return;
        }
        await router.push("/");
        toast({
            description: "Successfully logged in",
            status: "success"
        });
        setIsBusy(false);
    };

    return (
        <Card variant="outline" w="100%">
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
                                isLoading={http.isLoading || isBusy}
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
    const { isOpen, onOpen, onClose } = useDisclosure();
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<SignUpFormData>({
        resolver: zodResolver(SignUpValidator)
    });
    const http = useHttp();
    const toast = useToast();
    const router = useRouter();

    const onSubmit = async (formData: SignUpFormData) => {
        const { data, error } = await http.post<ApiData<SignUpResponse>>(
            "/api/auth/signup",
            formData
        );
        if (data?.status === "ok" && !error) {
            await router.push("/");
            toast({
                description: "Successfully singed up",
                status: "success"
            });
            return;
        }
        data?.usernameError &&
            setError("username", { message: data.usernameError });
        data?.passwordError &&
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
                            isLoading={http.isLoading}>
                            Sign up
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

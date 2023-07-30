import { getErrorMessage } from "@/lib/common/utilities";
import ColorModeToggle from "@/lib/components/ui/ColorModeToggle";
import { useAuth } from "@/lib/hooks/useAuth";
import {
    LoginFormData,
    LoginValidator
} from "@/lib/validators/login.validator";
import {
    SignUpFormData,
    SignUpValidator
} from "@/lib/validators/sign-up.validator";
import { Image } from "@chakra-ui/next-js";
import {
    Button,
    Card,
    CardBody,
    CardFooter,
    Center,
    Container,
    Flex,
    FormControl,
    FormErrorMessage,
    FormLabel,
    Heading,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    useDisclosure
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import Head from "next/head";
import { useForm } from "react-hook-form";
import brandImage from "../../public/favicon-32x32.png";

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
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<LoginFormData>({
        resolver: zodResolver(LoginValidator)
    });
    const { signIn, isSigningIn } = useAuth();

    const onSubmit = (formData: LoginFormData) => {
        signIn(formData).catch((error) => {
            setError("username", { message: "" });
            // show the message only below pwd field
            setError("password", { message: getErrorMessage(error) });
        });
    };

    return (
        <Flex direction="column" alignItems="center" w="100%" gap={10}>
            <Flex alignItems="center" gap={3}>
                <Image src={brandImage} alt="Holvi" />

                <Heading size="md" fontWeight="light">
                    HOLVI
                </Heading>
            </Flex>
            <Card variant="outline" w="100%" shadow="xl">
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
                                    isLoading={isSigningIn}
                                    form="login-form">
                                    Login
                                </Button>
                            </Flex>
                        </form>
                    </Flex>
                </CardBody>
                <CardFooter>
                    <Flex
                        alignItems="center"
                        justifyContent="space-between"
                        w="100%">
                        <ColorModeToggle />
                        <SignUpModal />
                    </Flex>
                </CardFooter>
            </Card>
        </Flex>
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
    const { isSigningUp, signUp } = useAuth();

    const onSubmit = async (formData: SignUpFormData) => {
        signUp(formData).catch((error) => {
            if ("usernameError" in error || "passwordError" in error) {
                error.usernameError &&
                    setError("username", { message: error.usernameError });
                error.passwordError &&
                    setError("password", { message: error.passwordError });
                return;
            }
            throw error;
        });
    };

    return (
        <>
            <Button type="button" onClick={onOpen} variant="ghost" size="sm">
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
                            isLoading={isSigningUp}>
                            Sign up
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

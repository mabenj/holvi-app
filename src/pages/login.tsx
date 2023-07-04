import { useLogin } from "@/lib/hooks/useLogin";
import { useSignUp } from "@/lib/hooks/useSignUp";
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
import Head from "next/head";
import { useRouter } from "next/router";
import { FormEvent } from "react";

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
    const {
        username,
        setUsername,
        password,
        setPassword,
        error,
        isLoggingIn,
        login
    } = useLogin();
    const { push } = useRouter();
    const toast = useToast();

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        login().then(() => {
            push("/");
            toast({
                description: "Successfully signed in",
                status: "success"
            });
        });
    };

    return (
        <Card variant="outline">
            <CardBody>
                <Flex direction="column" gap={5}>
                    <form id="login-form" onSubmit={handleSubmit}>
                        <Flex direction="column" gap={5}>
                            <FormControl isInvalid={!!error}>
                                <Input
                                    isRequired
                                    type="text"
                                    placeholder="Username"
                                    variant="filled"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                />
                            </FormControl>
                            <FormControl isInvalid={!!error}>
                                <Input
                                    isRequired
                                    type="password"
                                    placeholder="Password"
                                    variant="filled"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                />
                                <FormErrorMessage>{error}</FormErrorMessage>
                            </FormControl>

                            <Button
                                type="submit"
                                isLoading={isLoggingIn}
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
    const {
        username,
        setUsername,
        password,
        setPassword,
        password2,
        setPassword2,
        usernameError,
        passwordError,
        isLoading,
        signUp
    } = useSignUp();
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();

    const handleSignUp = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        signUp()
            .then(() => {
                onClose();
                toast({
                    description: "Successfully signed up",
                    status: "success"
                });
            })
            .catch((error) =>
                toast({
                    description: error,
                    status: "error"
                })
            );
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
                        <form id="sign-up-form" onSubmit={handleSignUp}>
                            <Flex direction="column" gap={5}>
                                <FormControl isInvalid={!!usernameError}>
                                    <FormLabel>Username</FormLabel>
                                    <Input
                                        isRequired
                                        type="text"
                                        placeholder="Username"
                                        variant="filled"
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(e.target.value)
                                        }
                                    />
                                    <FormErrorMessage>
                                        {usernameError}
                                    </FormErrorMessage>
                                </FormControl>
                                <FormControl isInvalid={!!passwordError}>
                                    <FormLabel>Password</FormLabel>
                                    <Input
                                        isRequired
                                        type="password"
                                        placeholder="Password"
                                        variant="filled"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                    />
                                    <FormErrorMessage>
                                        {passwordError}
                                    </FormErrorMessage>
                                </FormControl>
                                <FormControl isInvalid={!!passwordError}>
                                    <FormLabel>Confirm password</FormLabel>
                                    <Input
                                        isRequired
                                        type="password"
                                        placeholder="Password"
                                        variant="filled"
                                        value={password2}
                                        onChange={(e) =>
                                            setPassword2(e.target.value)
                                        }
                                    />
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

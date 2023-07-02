import { Box, Button, Container, Flex, useToast } from "@chakra-ui/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useLogin } from "../hooks/useLogin";
import { User } from "../interfaces/user";

interface LayoutProps {
    user?: User;
    children: React.ReactNode;
}

export default function Layout({ user, children }: LayoutProps) {
    return (
        <>
            <Head>
                <title>HomeWork</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Navbar username={user?.username} />
            <main>
                <Container maxW="7xl">
                    <Box py={10} />
                    {children}
                </Container>
            </main>
        </>
    );
}

const Navbar = ({ username }: { username?: string }) => {
    const { logout, isSigningOut } = useLogin();
    const { push } = useRouter();
    const toast = useToast();

    const handleLogout = () => {
        logout()
            .then(() => {
                push("/login");
                toast({
                    description: "You have been signed out",
                    status: "info"
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
        <nav>
            <Flex
                alignItems="center"
                justifyContent="space-between"
                w="100%"
                p={4}>
                <span>HomeWork</span>
                <Flex alignItems="center" gap={3}>
                    <span>
                        Logged in as <strong>{username}</strong>
                    </span>
                    <Button
                        type="button"
                        onClick={handleLogout}
                        size="sm"
                        isLoading={isSigningOut}>
                        Log out
                    </Button>
                </Flex>
            </Flex>
        </nav>
    );
};

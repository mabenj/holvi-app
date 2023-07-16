import { currentUser } from "@/pages/_app";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { Link } from "@chakra-ui/next-js";
import {
    Box,
    Button,
    Container,
    Flex,
    IconButton,
    useColorMode,
    useToast
} from "@chakra-ui/react";
import { useAtom } from "jotai";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { ApiResponse } from "../interfaces/api-response";

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [user] = useAtom(currentUser);

    return (
        <>
            <Head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Navbar username={user?.username} />
            <main>
                <Container maxW="7xl" p={[0, 0, 0, 5]}>
                    <Box py={10} />
                    {children}
                </Container>
            </main>
        </>
    );
}

const Navbar = ({ username }: { username?: string }) => {
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { colorMode, toggleColorMode } = useColorMode();
    const router = useRouter();
    const toast = useToast();

    const handleLogout = async () => {
        setIsSigningOut(true);
        const res: ApiResponse = await fetch("/api/auth/logout", {
            method: "POST"
        }).then((res) => res.json());
        if (res.status !== "ok") {
            toast({
                description: res.error,
                status: "error"
            });
        } else {
            await router.push("/login");
            toast({
                description: "You have been signed out",
                status: "info"
            });
        }
    };

    return (
        <nav>
            <Flex
                alignItems="center"
                justifyContent="space-between"
                w="100%"
                p={4}>
                <Link href="/" _hover={{ textDecoration: "none" }}>
                    holvi
                </Link>
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
                    <IconButton
                        size="sm"
                        variant="ghost"
                        icon={colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
                        aria-label={
                            colorMode === "dark" ? "Light mode" : "Dark mode"
                        }
                        title={
                            colorMode === "dark" ? "Light mode" : "Dark mode"
                        }
                        onClick={() => toggleColorMode()}
                    />
                </Flex>
            </Flex>
        </nav>
    );
};

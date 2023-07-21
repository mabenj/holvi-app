import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { Image, Link } from "@chakra-ui/next-js";
import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    IconButton,
    useColorMode,
    useToast
} from "@chakra-ui/react";
import Head from "next/head";
import { useRouter } from "next/router";
import brandImage from "../../../../public/favicon-32x32.png";
import { getErrorMessage } from "../../common/utilities";
import { useHttp } from "../../hooks/useHttp";
import { UserDto } from "../../interfaces/user-dto";

interface LayoutProps {
    children: React.ReactNode;
    user: UserDto;
}

export default function Layout({ children, user }: LayoutProps) {
    return (
        <>
            <Head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Navbar username={user.username} />
            <main>
                <Container maxW="7xl" p={[0, 0, 0, 5]}>
                    <Box py={5} />
                    {children}
                </Container>
            </main>
        </>
    );
}

const Navbar = ({ username }: { username?: string }) => {
    const http = useHttp();
    const { colorMode, toggleColorMode } = useColorMode();
    const router = useRouter();
    const toast = useToast();

    const handleLogout = async () => {
        const { error } = await http.post("/api/auth/logout");
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
    };

    return (
        <nav>
            <Flex
                alignItems="center"
                justifyContent="space-between"
                w="100%"
                p={4}>
                <Link href="/" _hover={{ textDecoration: "none" }}>
                    <Flex alignItems="center" gap={3}>
                        <Image
                            src={brandImage}
                            alt="Holvi"
                            placeholder="blur"
                        />

                        <Heading size="md" fontWeight="light">
                            HOLVI
                        </Heading>
                    </Flex>
                </Link>
                <Flex alignItems="center" gap={3}>
                    <strong>{username}</strong>
                    <Button
                        type="button"
                        onClick={handleLogout}
                        size="sm"
                        isLoading={http.isLoading}>
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

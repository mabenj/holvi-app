import { useAuth } from "@/lib/hooks/useAuth";
import { Image, Link } from "@chakra-ui/next-js";
import { Box, Button, Container, Flex, Heading } from "@chakra-ui/react";
import Head from "next/head";
import brandImage from "../../../../public/favicon-32x32.png";
import { UserDto } from "../../types/user-dto";
import ColorModeToggle from "./ColorModeToggle";

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
                <Container maxW="100vw" p={0}>
                    <Box py={5} />
                    {children}
                </Container>
            </main>
        </>
    );
}

const Navbar = ({ username }: { username?: string }) => {
    const { signOut, isSigningOut } = useAuth();

    return (
        <nav>
            <Flex
                alignItems="center"
                justifyContent="space-between"
                w="100%"
                p={4}>
                <Link href="/" _hover={{ textDecoration: "none" }}>
                    <Flex alignItems="center" gap={3}>
                        <Image src={brandImage} alt="Holvi" />

                        <Heading size="md" fontWeight="light">
                            HOLVI
                        </Heading>
                    </Flex>
                </Link>
                <Flex alignItems="center" gap={3}>
                    <strong>{username}</strong>
                    <Button
                        type="button"
                        onClick={signOut}
                        size="sm"
                        isLoading={isSigningOut}>
                        Log out
                    </Button>
                    <ColorModeToggle />
                </Flex>
            </Flex>
        </nav>
    );
};

import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import Head from "next/head";
import Image from "next/image";
import { ReactNode } from "react";
import brandImage from "../../../../public/android-chrome-192x192.png";

interface AuthLayoutProps {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer: ReactNode;
}

/** Frame of the sign-in and sign-up screens, sized for one-handed use on a phone */
export default function AuthLayout({
    title,
    subtitle,
    children,
    footer
}: AuthLayoutProps) {
    return (
        <>
            <Head>
                <title>{`${title} · Holvi`}</title>
                <meta name="description" content="Holvi, your private photo and video vault" />
            </Head>
            <Flex
                as="main"
                minH="100dvh"
                direction="column"
                justify="center"
                align="center"
                pt="calc(2rem + env(safe-area-inset-top))"
                pb="calc(2rem + env(safe-area-inset-bottom))"
                pl="calc(1.25rem + env(safe-area-inset-left))"
                pr="calc(1.25rem + env(safe-area-inset-right))">
                <Stack w="full" maxW="sm" gap="8">
                    <Stack gap="4">
                        <Box rounded="xl" overflow="hidden" w="14" h="14">
                            <Image
                                src={brandImage}
                                alt="Holvi"
                                width={56}
                                height={56}
                                priority
                            />
                        </Box>
                        <Stack gap="1">
                            <Heading as="h1" textStyle="3xl">
                                {title}
                            </Heading>
                            <Text color="fg.muted">{subtitle}</Text>
                        </Stack>
                    </Stack>
                    {children}
                    <Text textAlign="center" color="fg.muted">
                        {footer}
                    </Text>
                </Stack>
            </Flex>
        </>
    );
}

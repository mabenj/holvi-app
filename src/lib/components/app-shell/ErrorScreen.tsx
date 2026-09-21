import { Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import Head from "next/head";
import NextLink from "next/link";

interface ErrorScreenProps {
    code: number;
    title: string;
    description: string;
}

/** Full-screen error page with a way back to the Collections tab */
export default function ErrorScreen({ code, title, description }: ErrorScreenProps) {
    return (
        <>
            <Head>
                <title>{`${title} · Holvi`}</title>
            </Head>
            <Flex
                as="main"
                minH="100dvh"
                align="center"
                justify="center"
                pt="calc(2rem + env(safe-area-inset-top))"
                pb="calc(2rem + env(safe-area-inset-bottom))"
                pl="calc(1.25rem + env(safe-area-inset-left))"
                pr="calc(1.25rem + env(safe-area-inset-right))">
                <Stack gap="6" maxW="sm" textAlign="center" align="center">
                    <Text
                        textStyle="6xl"
                        fontWeight="bold"
                        color="fg.subtle"
                        lineHeight="1">
                        {code}
                    </Text>
                    <Stack gap="2">
                        <Heading as="h1" textStyle="2xl">
                            {title}
                        </Heading>
                        <Text color="fg.muted">{description}</Text>
                    </Stack>
                    <Button asChild size="lg">
                        <NextLink href="/">Back to Collections</NextLink>
                    </Button>
                </Stack>
            </Flex>
        </>
    );
}

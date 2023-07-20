import { Center, Container, Heading } from "@chakra-ui/react";
import Head from "next/head";

export default function Custom404() {
    return (
        <>
            <Head>
                <title>Not found</title>
            </Head>
            <main>
                <Container maxW="lg">
                    <Center w="100%" h="100dvh">
                        <Heading>404 - Not found</Heading>
                    </Center>
                </Container>
            </main>
        </>
    );
}

import { Center, Container, Heading } from "@chakra-ui/react";
import Head from "next/head";

export default function Custom500() {
    return (
        <>
            <Head>
                <title>Internal server error</title>
            </Head>
            <main>
                <Container maxW="lg">
                    <Center w="100%" h="100dvh">
                        <Heading>500 - Something went wrong... 🤷‍♂️</Heading>
                    </Center>
                </Container>
            </main>
        </>
    );
}

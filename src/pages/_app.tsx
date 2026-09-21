import ThemeColor from "@/lib/components/theme/ThemeColor";
import { system } from "@/lib/components/theme/system";
import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
    return (
        <ChakraProvider value={system}>
            {/* Chakra's dark styles key off the `dark` class that next-themes sets */}
            <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                themes={["dark", "light"]}
                enableSystem
                disableTransitionOnChange>
                <Head>
                    {/* viewport-fit=cover lets the layout reach under the notch and home indicator */}
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1, viewport-fit=cover"
                    />
                </Head>
                <ThemeColor />
                <Component {...pageProps} />
            </ThemeProvider>
        </ChakraProvider>
    );
}

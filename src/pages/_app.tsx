import "@/styles/globals.scss";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";
import type { AppProps } from "next/app";
import "react-photo-view/dist/react-photo-view.css";

const styles = {
    global: (props: any) => ({
        body: {
            bg: mode(
                "linear-gradient(-5deg, #f1f9ff 30%, #ffffff 100%)",
                "linear-gradient(-30deg, #1A202C 50%, #2c3444 100%)"
            )(props)
        }
    })
};

const theme = extendTheme({ styles });

export default function App({ Component, pageProps }: AppProps) {
    return (
        <ChakraProvider theme={theme}>
            <Component {...pageProps} />
        </ChakraProvider>
    );
}

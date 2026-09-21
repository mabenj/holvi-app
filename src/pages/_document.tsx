import { DARK_BACKGROUND } from "@/lib/components/theme/system";
import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
    return (
        // next-themes sets the theme class on <html> before React hydrates
        <Html lang="en" suppressHydrationWarning>
            <Head>
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="32x32"
                    href="/favicon-32x32.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="16x16"
                    href="/favicon-16x16.png"
                />
                <link rel="manifest" href="/site.webmanifest" />
                <link
                    rel="mask-icon"
                    href="/safari-pinned-tab.svg"
                    color="#5bbad5"
                />
                <meta name="msapplication-TileColor" content="#da532c" />
                {/* Dark is the default theme; ThemeColor follows the viewer's choice */}
                <meta name="theme-color" content={DARK_BACKGROUND} />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-title" content="Holvi" />
                {/* Content runs under the status bar; layouts pad by the safe-area insets */}
                <meta
                    name="apple-mobile-web-app-status-bar-style"
                    content="black-translucent"
                />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}

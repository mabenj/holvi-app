import {
    DARK_BACKGROUND,
    LIGHT_BACKGROUND
} from "@/lib/components/theme/system";
import { Head, Html, Main, NextScript } from "next/document";

// "theme" is the next-themes storage key; dark is the default when nothing is stored
const themeColorScript = `try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || (theme === "system" && matchMedia("(prefers-color-scheme: light)").matches)) {
        document.querySelector('meta[name="theme-color"]').setAttribute("content", "${LIGHT_BACKGROUND}");
    }
} catch (e) {}`;

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
                {/* Pick the light chrome colour before paint, as next-themes does for
                    the page, so a light-theme viewer never sees a dark status bar */}
                <script
                    dangerouslySetInnerHTML={{ __html: themeColorScript }}
                />
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

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Runs src/instrumentation.ts on server start, to recover backup jobs
        instrumentationHook: true
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "picsum.photos",
                port: ""
            }
        ]
    }
};

module.exports = nextConfig;

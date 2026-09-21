/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Next.js 15 bundles src/instrumentation.ts, which reaches the backup service.
    // These packages must stay plain Node.js requires: fluent-ffmpeg loads its code
    // dynamically, the ffmpeg/ffprobe packages locate their binaries relative to
    // themselves, and Sequelize loads its database driver by name.
    serverExternalPackages: [
        "fluent-ffmpeg",
        "ffmpeg-static",
        "ffprobe-static",
        "sequelize",
        "pg-hstore",
        "archiver"
    ],
    experimental: {
        // Chakra UI v3 exports hundreds of components; bundle only the used ones
        optimizePackageImports: ["@chakra-ui/react"]
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

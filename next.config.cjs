/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: false,
    compiler: {
        styledComponents: true,
    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };
        return config;
    },
    async redirects() {
        return [
            {
                source: '/index',
                destination: '/',
                permanent: true,
            },
        ];
    },
};

module.exports = nextConfig; 
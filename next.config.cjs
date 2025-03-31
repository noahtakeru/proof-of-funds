/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: false,
    compiler: {
        styledComponents: true,
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
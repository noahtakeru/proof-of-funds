/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@proof-of-funds/common'],
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, buffer: require.resolve('buffer/') };
    return config;
  },
};

module.exports = nextConfig;
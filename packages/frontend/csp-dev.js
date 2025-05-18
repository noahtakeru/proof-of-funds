/**
 * This file is a temporary solution for CSP issues during development.
 * It should not be used in production.
 */
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.polygon.technology https://*.infura.io https://*.walletconnect.org wss://*.walletconnect.org ws://localhost:* localhost:*;"
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  }
};
/** @type {import('next').NextConfig} */
const path = require('path');

// Define allowed origins for CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://proof-of-funds.example.com',
      'https://www.proof-of-funds.example.com'
    ];

// Add localhost in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

// Use different CSP settings for development and production
const isDev = process.env.NODE_ENV !== 'production';
const headerConfig = isDev 
  ? require('./csp-dev') 
  : {
    async headers() {
      return [
        {
          // Apply these headers to all routes
          source: '/(.*)',
          headers: [
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'Referrer-Policy', 
              value: 'strict-origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
            }
          ],
        },
        {
          // Apply CSP headers to frontend pages with settings for wallet providers
          source: '/((?!api/).*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: 
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " + // Unsafe-inline needed for wallet providers
                "connect-src 'self' https://*.polygon.technology https://*.infura.io https://*.walletconnect.org wss://*.walletconnect.org; " +
                "img-src 'self' data:; " +
                "style-src 'self' 'unsafe-inline'; " +
                "font-src 'self'; " +
                "frame-ancestors 'none'; " +
                "form-action 'self'"
            }
          ],
        },
        {
          // Strict CSP for API routes
          source: '/api/:path*',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: "default-src 'none'; frame-ancestors 'none';",
            }
          ],
        }
      ];
    },
  };

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@proof-of-funds/common', 'snarkjs', 'fastfile', 'ffjavascript', 'ioredis'],
  
  // Add contract address to both public and server runtime configs
  // Making sure we prioritize direct environment variables
  // No fallbacks - must be explicitly set in environment
  publicRuntimeConfig: {
    PROOF_CONTRACT_ADDRESS: process.env.PROOF_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_PROOF_CONTRACT_ADDRESS,
  },
  serverRuntimeConfig: {
    PROOF_CONTRACT_ADDRESS: process.env.PROOF_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_PROOF_CONTRACT_ADDRESS,
  },
  
  // Use environment-specific headers
  headers: headerConfig.headers,
  
  // Force HTTPS in production
  async rewrites() {
    return process.env.NODE_ENV === 'production' ? [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://:path*',
      },
    ] : [];
  },
  webpack: (config, { isServer }) => {
    // Handle snarkjs ESM/CJS interoperability and server-only modules
    config.resolve.fallback = { 
      ...config.resolve.fallback, 
      fs: false,
      readline: false,
      os: false,
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      constants: false,
      net: false,
      tls: false,
      'ioredis': isServer ? require.resolve('ioredis') : false,
    };
    
    // Ensure snarkjs can be properly imported in browser
    if (!isServer) {
      // Add alias for constants module to use our shim
      config.resolve.alias = {
        ...config.resolve.alias,
        constants: path.resolve(__dirname, './lib/constants-shim.js')
      };
      
      // Fix for fastfile named exports error
      config.module.rules.push({
        test: /node_modules\/fastfile\/src\/fastfile\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              // Fix O_TRUNC and other named exports
              ['module-resolver', {
                resolvePath(sourcePath, currentFile, opts) {
                  if (sourcePath === 'constants' && currentFile.includes('fastfile')) {
                    return path.resolve(__dirname, './lib/constants-shim.js');
                  }
                  if (sourcePath === 'fs' && currentFile.includes('fastfile')) {
                    return 'browserify-fs';
                  }
                  return sourcePath;
                },
              }],
            ],
          },
        },
      });
      
      // Add specific handling for snarkjs dependencies
      config.module.rules.push({
        test: /node_modules\/(snarkjs|ffjavascript)\/.*\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              '@babel/plugin-proposal-optional-chaining',
              '@babel/plugin-proposal-nullish-coalescing-operator',
            ],
          },
        },
      });
    }
    
    return config;
  },
};

module.exports = nextConfig;
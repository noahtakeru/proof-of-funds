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

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@proof-of-funds/common', 'snarkjs', 'fastfile', 'ffjavascript'],
  
  // Security headers configuration
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
          }
        ],
      },
      {
        // Apply additional strict headers to API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'; connect-src 'self' https://*.polygon.technology; img-src 'self' data:;",
          }
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Handle snarkjs ESM/CJS interoperability
    config.resolve.fallback = { 
      ...config.resolve.fallback, 
      fs: false,
      readline: false,
      os: false,
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      constants: false
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
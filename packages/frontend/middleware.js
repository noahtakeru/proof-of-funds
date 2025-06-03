/**
 * Enhanced global middleware for CORS, CSP, and comprehensive security headers
 * 
 * This middleware provides:
 * 1. Origin validation and CORS headers for cross-domain requests
 * 2. Comprehensive security headers (CSP, HSTS, X-Content-Type-Options, etc.)
 * 3. Different CSP policies for API vs frontend routes
 * 4. Environment-specific behavior for development/production
 */
import { NextResponse } from 'next/server';

// Allowed origins for CORS - read from environment or use defaults
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

export function middleware(request) {
  // Get the origin from the request
  const origin = request.headers.get('origin') || '';
  
  // Get the request path
  const path = request.nextUrl.pathname;
  
  // Create response
  const response = NextResponse.next();
  
  // Add CORS headers if the origin is allowed or in development
  if (origin && (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production')) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-API-Key, X-Requested-With');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }
  } else if (origin && process.env.NODE_ENV === 'production') {
    // Block disallowed origins in production
    return new NextResponse(null, {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'forbidden',
        message: 'Origin not allowed'
      })
    });
  }
  
  // Apply security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Apply appropriate CSP based on route and environment
  if (path.startsWith('/api/')) {
    // Strict CSP for API routes
    response.headers.set('Content-Security-Policy', 'default-src \'none\'; frame-ancestors \'none\'');
  } else if (process.env.NODE_ENV !== 'production') {
    // Development CSP with unsafe-eval for Next.js hot reloading
    // Using minimal restrictions for development to prevent CSP issues
    response.headers.set('Content-Security-Policy', 
      'default-src * \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob:; ' +
      'script-src * \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob:; ' + 
      'connect-src * \'self\' data: blob:; ' +
      'img-src * \'self\' data: blob:; ' +
      'style-src * \'self\' \'unsafe-inline\' data: blob:; ' +
      'font-src * \'self\' data: blob:; ' +
      'frame-src * \'self\' data: blob:; ' +
      'object-src \'none\'; ' +
      'base-uri \'self\''
    );
  } else {
    // Production CSP for frontend pages (strict but functional)
    response.headers.set('Content-Security-Policy', 
      'default-src \'self\'; ' +
      'script-src \'self\' \'unsafe-inline\' https://*.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com; ' + 
      'connect-src \'self\' https://*.polygon.technology https://*.infura.io https://*.walletconnect.org ' +
      'https://*.moralis.io https://deep-index.moralis.io https://api.moralis.io https://api.coingecko.com https://pro-api.coingecko.com ' +
      'wss://*.walletconnect.org https://*.googletagmanager.com https://www.google-analytics.com ' +
      'https://www.googleapis.com https://storage.googleapis.com; ' +
      'img-src \'self\' data: https://www.googletagmanager.com https://www.google-analytics.com; ' +
      'style-src \'self\' \'unsafe-inline\'; ' +
      'font-src \'self\'; ' +
      'frame-ancestors \'none\'; ' +
      'form-action \'self\''
    );
  }
  
  // Add HSTS header in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  return response;
}

// Apply middleware to all routes except static assets
export const config = {
  matcher: ['/((?!_next/static|favicon.ico|assets/).*)'],
};
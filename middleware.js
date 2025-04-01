import { NextResponse } from 'next/server';

export function middleware(request) {
    // Get the pathname of the request
    const { pathname } = request.nextUrl;

    // If it's the home page, redirect to the ZK home page
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/zk-home', request.url));
    }

    // Otherwise, continue with the request
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}; 
import { NextResponse } from 'next/server';

export function middleware(request) {
    // Get the pathname of the request
    const { pathname } = request.nextUrl;

    // No redirection - allow the home page to render normally
    // Continue with the request
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
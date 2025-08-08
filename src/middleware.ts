import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip /api/webhook and anything under it
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next(); // skip middleware
  }

  // Skip documentation endpoints - allow public access
  if (pathname.startsWith('/api/docs') || pathname.startsWith('/docs') || pathname.startsWith('/api-docs')) {
    return NextResponse.next(); // skip middleware
  }

  // For API routes, handle authentication and store user data
  if (pathname.startsWith('/api/')) {
    try {
      // Get user from Stack authentication
      const user = await stackServerApp.getUser();
      
      if (!user) {
        return NextResponse.redirect(new URL('/handler/sign-in', request.url));
      }

      // Clone the request and add user data to headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);

      // Return the request with user data in headers
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('Middleware authentication error:', error);
      return NextResponse.redirect(new URL('/handler/sign-in', request.url));
    }
  }

  // For non-API routes, just check if user is authenticated
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/docs', '/api-docs'],
};

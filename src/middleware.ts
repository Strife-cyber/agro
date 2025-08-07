import { stackServerApp } from "@/stack";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip /api/webhook and anything under it
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next(); // skip middleware
  }

  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/handler/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

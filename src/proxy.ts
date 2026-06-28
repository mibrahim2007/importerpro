import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Not authenticated
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Super admin routes
  if (pathname.startsWith('/admin') && !session.user.isSuperAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Tenant routes require tenantSlug
  if (!pathname.startsWith('/admin') && !session.user.isSuperAdmin && !session.user.tenantSlug) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

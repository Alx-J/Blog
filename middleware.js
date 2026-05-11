import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'change-this-secret');

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow login page through
  if (pathname === '/admin/login') return NextResponse.next();

  // Protect all /admin/* pages
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch {
      const res = NextResponse.redirect(new URL('/admin/login', request.url));
      res.cookies.delete('auth_token');
      return res;
    }
  }

  // Protect admin API routes (non-GET)
  if (pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

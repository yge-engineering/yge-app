// Next.js middleware — auth gate.
//
// Plain English: every request hits here first. If you don't have a
// `yge-session` cookie, we punt you to /login (except for the login
// page itself, the static assets, and the API health check). Once
// Supabase is wired we'll swap the cookie check for a Supabase token
// validation in the same spot.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api/health')) return true;
  if (pathname.match(/\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/i)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = req.cookies.get('yge-session')?.value;
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except the Next internals already handled in
  // isPublic above. Keeps the matcher simple — the function itself
  // does the real allow-list check.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

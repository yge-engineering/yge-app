// /sso-complete — completes the Microsoft SSO sign-in handoff.
//
// Plain English: user clicked "Sign in with Microsoft" → bounced to
// Microsoft → Microsoft sent them back to the API callback → API
// looked up their portal user, generated a one-time token, and
// redirected them here with ?token=<token>.
//
// This server component:
//   1. Reads the token from the URL.
//   2. Server-to-server fetch to /api/microsoft/sso-claim to swap
//      the token for the email (one-time consume).
//   3. Verifies a portal-user row + sets the YGE session cookie via
//      setSessionCookie.
//   4. Redirects to /dashboard (or the return URL).
//
// On any error, redirects to /login with an `?sso=error&reason=...`
// query so the user sees what went wrong.

import { redirect } from 'next/navigation';
import {
  findPortalUser,
  setSessionCookie,
} from '../../lib/auth';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function claim(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/microsoft/sso-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { email?: string };
    return j.email ?? null;
  } catch {
    return null;
  }
}

export default async function SsoCompletePage({
  searchParams,
}: {
  searchParams: { token?: string; return?: string };
}) {
  const token = searchParams.token;
  if (!token) {
    redirect('/login?sso=error&reason=Missing+token');
  }
  const email = await claim(token);
  if (!email) {
    redirect('/login?sso=error&reason=Token+expired+or+invalid');
  }
  const user = await findPortalUser(email);
  if (!user) {
    redirect('/login?sso=denied&email=' + encodeURIComponent(email));
  }
  setSessionCookie(user);
  const dest =
    searchParams.return && searchParams.return.startsWith('/')
      ? searchParams.return
      : '/dashboard';
  redirect(dest);
}

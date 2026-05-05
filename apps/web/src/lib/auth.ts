// Authentication helpers — backed by the API's portal-users store.
//
// Plain English: every signed-in user has a row at /api/portal-users.
// Ryan + Brook are seeded there automatically; new users are added
// via /admin/portal-users. findPortalUser() is the single source of
// truth — login actions call it before issuing a session cookie.
//
// findSeededUser() is a fallback used when the API is unreachable;
// it still returns Brook + Ryan so a local boot works without the
// API up. Production should not depend on it.

import { cookies } from 'next/headers';
import type { PortalRole } from '@yge/shared';

export interface YgeUser {
  email: string;
  name: string;
  role: PortalRole;
}

// Bootstrap fallback used only when the API is unreachable.
const SEEDED_USERS: YgeUser[] = [
  { email: 'brookyoung@youngge.com', name: 'Brook L Young', role: 'PRESIDENT' },
  { email: 'ryoung@youngge.com', name: 'Ryan D Young', role: 'VP' },
];

const COOKIE_NAME = 'yge-session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

/** Look up a portal user by email via the API. Returns null if the
 *  email is not on the access list, or the user is disabled. */
export async function findPortalUser(email: string): Promise<YgeUser | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(target)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return findSeededUser(target);
    const json = (await res.json()) as {
      user?: {
        email: string;
        name: string;
        role: PortalRole;
        disabled?: boolean;
      };
    };
    const u = json.user;
    if (!u || u.disabled) return null;
    return { email: u.email, name: u.name, role: u.role };
  } catch {
    // API unreachable — fall back to seeded list so Brook + Ryan can
    // still get in during outages.
    return findSeededUser(target);
  }
}

/** Bootstrap fallback. Returns Brook or Ryan when the API isn't
 *  reachable. Kept exported for the existing dev-mode imports. */
export function findSeededUser(email: string): YgeUser | null {
  const target = email.trim().toLowerCase();
  for (const u of SEEDED_USERS) {
    if (u.email.toLowerCase() === target) return u;
  }
  return null;
}

/** Read the current user from the session cookie, if any. */
export function getCurrentUser(): YgeUser | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as YgeUser;
    if (typeof parsed.email !== 'string' || typeof parsed.name !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Server-side helper that throws if there is no logged-in user.
 *  Call this at the top of any protected page. */
export function requireUser(): YgeUser {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Not signed in. Redirect to /login.');
  }
  return user;
}

/** Set the session cookie. Called from the sign-in server action. */
export function setSessionCookie(user: YgeUser): void {
  cookies().set(COOKIE_NAME, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie. Called from sign-out. */
export function clearSessionCookie(): void {
  cookies().delete(COOKIE_NAME);
}

/** True iff Supabase env vars are set. The login page uses this to
 *  decide whether to show the dev-mode notice. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

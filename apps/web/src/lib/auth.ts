// Authentication helpers — dev-mode + Supabase-ready.
//
// Plain English: until Supabase is wired up, this lets Ryan + Brook
// log in by typing their email and clicking Sign In. The "user" lives
// in a cookie. When Supabase env vars are set later, the same helpers
// will switch to real auth without any UI changes.

import { cookies } from 'next/headers';

export interface YgeUser {
  email: string;
  name: string;
  role: 'PRESIDENT' | 'VP' | 'OFFICE' | 'FOREMAN' | 'CREW';
}

// The two real users for now. Email is the unique key. Anyone else is
// rejected at sign-in until we add an "invite" flow.
const SEEDED_USERS: YgeUser[] = [
  { email: 'brookyoung@youngge.com', name: 'Brook L Young', role: 'PRESIDENT' },
  { email: 'ryoung@youngge.com', name: 'Ryan D Young', role: 'VP' },
];

const COOKIE_NAME = 'yge-session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Look up a seeded user by email (case-insensitive). Returns null if
 *  no user matches. */
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

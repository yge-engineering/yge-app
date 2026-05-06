'use server';

// Server actions that drive the passkey (Face ID / Touch ID) sign-in
// flow. The browser does the actual navigator.credentials call; these
// functions proxy to the API on either side of that step.
//
// Why not call the API directly from the client: we want session
// cookies set on the web origin (app.youngge.com), and we want the
// API URL to stay server-side env config. The web server actions
// satisfy both.

import { findPortalUser, setSessionCookie } from '../../lib/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface PasskeyAuthOptions {
  ok: boolean;
  options?: unknown;
  error?: string;
}

export interface PasskeyAuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Step 1 of passkey sign-in: ask the API for a challenge + the list of
 * registered credentials for this email. The browser then calls
 * navigator.credentials.get() with these options.
 */
export async function startPasskeyAuth(
  email: string,
): Promise<PasskeyAuthOptions> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: 'Enter your work email.' };
  const user = await findPortalUser(trimmed);
  if (!user) {
    return {
      ok: false,
      error: 'That email is not on the access list.',
    };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/webauthn/auth/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
      cache: 'no-store',
    });
    if (res.status === 404) {
      return {
        ok: false,
        error:
          'No passkey on file for this email. Sign in with your password first, then set one up.',
      };
    }
    if (!res.ok) {
      return { ok: false, error: `Could not start (HTTP ${res.status})` };
    }
    const options = await res.json();
    return { ok: true, options };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not start',
    };
  }
}

/**
 * Step 2 of passkey sign-in: hand the signed assertion to the API. If
 * it verifies we drop a session cookie and the caller redirects.
 */
export async function finishPasskeyAuth(
  email: string,
  response: unknown,
): Promise<PasskeyAuthResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: 'Enter your work email.' };
  const user = await findPortalUser(trimmed);
  if (!user) {
    return { ok: false, error: 'That email is not on the access list.' };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/webauthn/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed, response }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: body.error ?? `Verify failed (HTTP ${res.status})`,
      };
    }
    setSessionCookie(user);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Verify failed',
    };
  }
}

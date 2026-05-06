'use server';

// Server actions for passkey registration. Driven from
// /account/passkeys after the user is signed in. The browser does the
// navigator.credentials.create() call between these two functions.

import { requireUser } from '../../../lib/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface RegisterOptionsResult {
  ok: boolean;
  options?: unknown;
  error?: string;
}

export interface RegisterVerifyResult {
  ok: boolean;
  credentialId?: string;
  error?: string;
}

/**
 * Step 1 of registration: ask the API for registration options bound
 * to the signed-in user's email. We don't expose this to anonymous
 * users — only the logged-in account can add a passkey.
 */
export async function startPasskeyRegister(
  nickname: string,
): Promise<RegisterOptionsResult> {
  const user = requireUser();
  try {
    const res = await fetch(`${API_BASE_URL}/api/webauthn/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
      }),
      cache: 'no-store',
    });
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
 * Step 2 of registration: hand the attestation back. API verifies +
 * stores the public key for future sign-ins.
 */
export async function finishPasskeyRegister(
  nickname: string,
  response: unknown,
): Promise<RegisterVerifyResult> {
  const user = requireUser();
  try {
    const res = await fetch(`${API_BASE_URL}/api/webauthn/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        response,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: body.error ?? `Verify failed (HTTP ${res.status})`,
      };
    }
    const json = (await res.json()) as { credentialId?: string };
    return { ok: true, credentialId: json.credentialId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Verify failed',
    };
  }
}

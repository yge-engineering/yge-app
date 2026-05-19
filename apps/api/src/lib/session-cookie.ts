// Session-cookie HMAC sign / verify helpers (server-side).
//
// Plain English: the YGE session cookie carries the signed-in user
// (email, name, role) as JSON. Without a signature anyone who can
// write to your browser cookies can hand-craft a session for any
// role. This module signs the JSON with HMAC-SHA256 + a shared
// server secret so any tampering is detected.
//
// Lives in apps/api (not packages/shared) because it uses Node
// built-ins (crypto + Buffer) that don't belong in the shared
// bundle. The web app's apps/web/src/lib/session-cookie.ts is a
// byte-identical sibling — keep them in sync.
//
// Wire format:    "s1." base64url(json) "." base64url(hmac256(secret, json))
//
// The "s1." prefix discriminates signed cookies from the legacy
// URL-encoded JSON format — JSON values can contain unencoded "."
// characters (encodeURIComponent leaves them alone), so a presence-
// of-dot check isn't enough.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SEP = '.';
const SIGNED_PREFIX = 's1.';

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(padded, 'base64');
}

function hmacOf(secret: string, body: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(body).digest());
}

/**
 * Sign a session payload. When `secret` is empty, falls back to the
 * legacy unsigned format (raw JSON, URL-encoded) so existing
 * deploys keep working until they configure YGE_SESSION_SECRET.
 */
export function signSession(payload: unknown, secret: string): string {
  const json = JSON.stringify(payload);
  if (!secret) {
    return encodeURIComponent(json);
  }
  const body = b64urlEncode(Buffer.from(json, 'utf8'));
  return `${SIGNED_PREFIX}${body}${SEP}${hmacOf(secret, body)}`;
}

export interface VerifyResult<T> {
  payload: T | null;
  /** True when an HMAC was present and matched. False when the
   *  cookie was in the legacy unsigned format OR the signature
   *  didn't match. */
  signed: boolean;
  /** True iff the payload is structurally valid (JSON parsed +
   *  not null). */
  valid: boolean;
}

/**
 * Verify and decode a session cookie. Accepts both signed (when
 * secret is non-empty) and legacy unsigned cookies.
 */
export function verifySession<T = unknown>(
  raw: string,
  secret: string,
): VerifyResult<T> {
  if (!raw) return { payload: null, signed: false, valid: false };

  // Signed format: must start with `s1.` then have body.signature.
  if (raw.startsWith(SIGNED_PREFIX) && secret) {
    const after = raw.slice(SIGNED_PREFIX.length);
    const idx = after.indexOf(SEP);
    if (idx > 0) {
      const body = after.slice(0, idx);
      const sig = after.slice(idx + 1);
      const expected = hmacOf(secret, body);
      const got = Buffer.from(sig);
      const want = Buffer.from(expected);
      if (got.length !== want.length || !timingSafeEqual(got, want)) {
        return { payload: null, signed: false, valid: false };
      }
      try {
        const json = b64urlDecode(body).toString('utf8');
        const parsed = JSON.parse(json) as T;
        return { payload: parsed, signed: true, valid: parsed != null };
      } catch {
        return { payload: null, signed: true, valid: false };
      }
    }
    // Malformed signed cookie (no separator after prefix).
    return { payload: null, signed: false, valid: false };
  }

  // Legacy unsigned path — URL-encoded JSON. Accepted whether or not
  // a secret is configured so existing browser sessions keep working
  // through the YGE_SESSION_SECRET rollout.
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as T;
    return { payload: parsed, signed: false, valid: parsed != null };
  } catch {
    return { payload: null, signed: false, valid: false };
  }
}

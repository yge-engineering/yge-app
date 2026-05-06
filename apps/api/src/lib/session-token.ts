// HMAC-signed mobile session token.
//
// Token format: base64url(payload).base64url(sig) where:
//   payload = JSON {sub: email, name?, exp: unix-seconds}
//   sig     = HMAC-SHA256(payload, secret)
//
// The signing secret comes from MOBILE_TOKEN_SECRET env var. If unset,
// we fall back to a process-startup random — fine for development but
// invalidates all tokens on server restart. Production must set the
// env var.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const FALLBACK_SECRET = randomBytes(32).toString('hex');

function secret(): string {
  return process.env.MOBILE_TOKEN_SECRET ?? FALLBACK_SECRET;
}

interface TokenPayload {
  sub: string; // email
  name?: string;
  exp: number; // unix seconds
}

function b64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function issueToken(payload: { email: string; name?: string }): string {
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  const body: TokenPayload = { sub: payload.email, name: payload.name, exp };
  const json = JSON.stringify(body);
  const encoded = b64UrlEncode(json);
  const sig = createHmac('sha256', secret()).update(encoded).digest();
  return `${encoded}.${b64UrlEncode(sig)}`;
}

export function verifyToken(
  token: string,
): { email: string; name?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sigStr] = parts;
  if (!encoded || !sigStr) return null;
  const expected = createHmac('sha256', secret()).update(encoded).digest();
  let provided: Buffer;
  try {
    provided = b64UrlDecode(sigStr);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  let body: TokenPayload;
  try {
    body = JSON.parse(b64UrlDecode(encoded).toString('utf8'));
  } catch {
    return null;
  }
  if (typeof body.sub !== 'string' || typeof body.exp !== 'number') return null;
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  return { email: body.sub, name: body.name };
}

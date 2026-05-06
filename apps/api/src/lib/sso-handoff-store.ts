// SSO handoff store — one-time tokens that bridge the OAuth callback
// (API origin) to the YGE session cookie (web origin).
//
// Plain English: when the user clicks "Sign in with Microsoft", we
// run OAuth on the API, look up the portal user, and need to hand
// the result to the web app so it can drop a YGE session cookie on
// app.youngge.com. Cross-origin cookies are messy, so instead we
// store a short-lived random token here, redirect to the web with
// that token in the URL, and the web exchanges it for the email
// via a server-to-server call. The token is one-time and expires
// in 60 seconds.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

interface Handoff {
  token: string;
  email: string;
  createdAt: number; // epoch ms
  consumedAt?: number;
}

const TTL_MS = 60_000;

function dataDir(): string {
  return (
    process.env.SSO_HANDOFF_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'sso-handoffs')
  );
}
function filePath(): string {
  return path.join(dataDir(), 'handoffs.json');
}

async function readAll(): Promise<Handoff[]> {
  try {
    const raw = await fs.readFile(filePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Handoff[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
async function writeAll(entries: Handoff[]): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(entries, null, 2), 'utf8');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Create a fresh handoff token bound to this email. */
export async function createHandoff(email: string): Promise<string> {
  const all = await readAll();
  const now = Date.now();
  // Drop expired or consumed-and-old entries.
  const fresh = all.filter(
    (h) =>
      now - h.createdAt < TTL_MS * 5 && // keep some history for debugging
      !(h.consumedAt && now - h.consumedAt > TTL_MS),
  );
  const token = newToken();
  fresh.push({ token, email: email.trim().toLowerCase(), createdAt: now });
  await writeAll(fresh);
  return token;
}

/** Consume the token, return the email if valid + unexpired + unconsumed.
 *  Marks the token consumed so it can't be reused. */
export async function consumeHandoff(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;
  const all = await readAll();
  const now = Date.now();
  const idx = all.findIndex((h) => h.token === token);
  if (idx < 0) return null;
  const h = all[idx]!;
  if (h.consumedAt) return null;
  if (now - h.createdAt > TTL_MS) return null;
  all[idx] = { ...h, consumedAt: now };
  await writeAll(all);
  return h.email;
}

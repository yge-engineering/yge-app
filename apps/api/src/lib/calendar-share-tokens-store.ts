// Calendar share tokens — per-user opaque tokens that authorize a
// read-only iCal feed.
//
// Plain English: when Ryan or Brook clicks "Connect to Outlook", we
// hand them a long-random URL like
//   https://yge-api.onrender.com/api/calendar-share/feed/<token>.ics
// They paste that URL into their calendar app's "Add subscription"
// box and the app polls it on its own schedule. No login needed —
// the token IS the auth. Tokens are bound to the user's email so the
// feed knows whose events to include.
//
// Stored at data/calendar-share-tokens.json. Tokens never expire
// today; revoke + reissue is a future feature.

import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';

interface StoredToken {
  /** Lowercase email — owner of the feed. */
  email: string;
  /** 48-char hex token (24 random bytes). Opaque. */
  token: string;
  /** ISO datetime when issued. */
  issuedAt: string;
}

interface FileShape {
  tokens: StoredToken[];
}

function dataDir(): string {
  return process.env.CALENDAR_SHARE_DATA_DIR ?? path.resolve(process.cwd(), 'data');
}
function filePath(): string {
  return path.join(dataDir(), 'calendar-share-tokens.json');
}

async function readAll(): Promise<FileShape> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8');
    return JSON.parse(raw) as FileShape;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { tokens: [] };
    throw err;
  }
}
async function writeAll(data: FileShape): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(data, null, 2));
}

/** Returns the existing token for this email, creating one if there
 *  isn't one yet. The token is stable until the user explicitly
 *  rotates it via revoke (future). */
export async function getOrCreateShareToken(email: string): Promise<string> {
  const norm = email.toLowerCase();
  const file = await readAll();
  const existing = file.tokens.find((t) => t.email === norm);
  if (existing) return existing.token;
  const token = randomBytes(24).toString('hex');
  file.tokens.push({
    email: norm,
    token,
    issuedAt: new Date().toISOString(),
  });
  await writeAll(file);
  return token;
}

/** Reverse lookup: given a token, return the email it belongs to. */
export async function emailForShareToken(token: string): Promise<string | null> {
  const file = await readAll();
  const found = file.tokens.find((t) => t.token === token);
  return found ? found.email : null;
}

/** Rotate the token for an email — invalidates any subscriptions that
 *  used the old URL. Returns the new token. */
export async function rotateShareToken(email: string): Promise<string> {
  const norm = email.toLowerCase();
  const file = await readAll();
  const idx = file.tokens.findIndex((t) => t.email === norm);
  const token = randomBytes(24).toString('hex');
  const row: StoredToken = {
    email: norm,
    token,
    issuedAt: new Date().toISOString(),
  };
  if (idx >= 0) file.tokens[idx] = row;
  else file.tokens.push(row);
  await writeAll(file);
  return token;
}

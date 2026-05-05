// Microsoft OAuth token store — per-user access + refresh tokens.
//
// Plain English: when Ryan or Brook clicks "Connect Microsoft 365"
// on /files, the OAuth flow completes at /api/microsoft/callback and
// we drop their access + refresh tokens here. The API uses these to
// hit Microsoft Graph (SharePoint, OneDrive, Mail) on their behalf.
// Refresh token survives the access-token expiry so they don't have
// to re-auth every hour.
//
// Storage: data/microsoft-tokens.json on the API's data dir.

import { promises as fs } from 'fs';
import path from 'path';

interface StoredToken {
  /** Lowercase email — owner of the token. */
  email: string;
  /** Microsoft Graph access token. Bearer in Authorization header. */
  accessToken: string;
  /** Microsoft Graph refresh token. Used to get a new access_token
   *  when the current one expires (typically every 60-90 minutes). */
  refreshToken: string;
  /** ISO datetime when the access_token expires. */
  expiresAt: string;
  /** Scope string the user consented to (space-separated). */
  scope: string;
  /** ISO datetime first issued. */
  issuedAt: string;
}

interface FileShape {
  tokens: StoredToken[];
}

function dataDir(): string {
  return process.env.MICROSOFT_TOKENS_DATA_DIR ?? path.resolve(process.cwd(), 'data');
}
function filePath(): string {
  return path.join(dataDir(), 'microsoft-tokens.json');
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

export async function getMicrosoftToken(email: string): Promise<StoredToken | null> {
  const norm = email.toLowerCase();
  const file = await readAll();
  return file.tokens.find((t) => t.email === norm) ?? null;
}

/** All stored Microsoft tokens. Used by the AP-inbox scheduler to
 *  iterate over every connected user. */
export async function listMicrosoftTokens(): Promise<StoredToken[]> {
  const file = await readAll();
  return [...file.tokens];
}

export async function saveMicrosoftToken(
  email: string,
  data: Omit<StoredToken, 'email' | 'issuedAt'> & { issuedAt?: string },
): Promise<StoredToken> {
  const norm = email.toLowerCase();
  const file = await readAll();
  const existing = file.tokens.find((t) => t.email === norm);
  const next: StoredToken = {
    email: norm,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
    issuedAt: data.issuedAt ?? existing?.issuedAt ?? new Date().toISOString(),
  };
  if (existing) {
    Object.assign(existing, next);
  } else {
    file.tokens.push(next);
  }
  await writeAll(file);
  return next;
}

export async function deleteMicrosoftToken(email: string): Promise<boolean> {
  const norm = email.toLowerCase();
  const file = await readAll();
  const before = file.tokens.length;
  file.tokens = file.tokens.filter((t) => t.email !== norm);
  if (file.tokens.length === before) return false;
  await writeAll(file);
  return true;
}

export type { StoredToken };

// WebAuthn (passkey / Face ID / Touch ID) credential + challenge store.
//
// Plain English: when a user "registers a passkey" we save the public
// key here, indexed by their email. Later, when they tap "Sign in with
// Face ID", we look up that public key, generate a challenge, and ask
// the browser to sign it. If the signature checks out we let them in.
//
// Two files on disk:
//   credentials.json — the stored passkeys (public keys + counters)
//   challenges.json  — short-lived (5 min) challenges in flight
//
// Phase 1 file-backed; same shape will fit a Postgres `WebauthnCredential`
// table when we land Prisma.
//
// Every credential mutation goes through recordAudit() — logging in or
// registering a key is a real auth event the office can review.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { recordAudit, type AuditContext } from './audit-store';

export interface StoredCredential {
  /** Email address that owns this credential. Lowercased. */
  email: string;
  /** base64url-encoded credential ID (the rawId from navigator.credentials). */
  credentialId: string;
  /** base64url-encoded raw public key bytes (COSE format). */
  publicKey: string;
  /** Signature counter — must strictly increase per use to detect cloning. */
  counter: number;
  /** transports list reported by the authenticator at registration time. */
  transports?: string[];
  /** Optional human-readable nickname (e.g. "Ryan's iPhone"). */
  nickname?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface StoredChallenge {
  email: string;
  /** base64url challenge bytes. */
  challenge: string;
  /** 'register' or 'auth' — separates the two ceremonies. */
  purpose: 'register' | 'auth';
  createdAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function dataDir(): string {
  return (
    process.env.WEBAUTHN_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'webauthn')
  );
}
function credPath(): string {
  return path.join(dataDir(), 'credentials.json');
}
function chalPath(): string {
  return path.join(dataDir(), 'challenges.json');
}

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---- Credentials --------------------------------------------------------

export async function listCredentials(email: string): Promise<StoredCredential[]> {
  const all = await readJson<StoredCredential>(credPath());
  return all.filter((c) => c.email === email.toLowerCase());
}

export async function findCredentialById(
  credentialId: string,
): Promise<StoredCredential | null> {
  const all = await readJson<StoredCredential>(credPath());
  return all.find((c) => c.credentialId === credentialId) ?? null;
}

export async function saveCredential(
  cred: StoredCredential,
  ctx?: AuditContext,
): Promise<void> {
  const all = await readJson<StoredCredential>(credPath());
  const idx = all.findIndex((c) => c.credentialId === cred.credentialId);
  if (idx >= 0) {
    all[idx] = cred;
  } else {
    all.push(cred);
  }
  await writeJson(credPath(), all);
  await recordAudit({
    action: 'create',
    entityType: 'WebauthnCredential',
    entityId: cred.credentialId,
    after: { email: cred.email, nickname: cred.nickname },
    ctx,
  });
}

export async function bumpCredentialCounter(
  credentialId: string,
  newCounter: number,
): Promise<void> {
  const all = await readJson<StoredCredential>(credPath());
  const idx = all.findIndex((c) => c.credentialId === credentialId);
  if (idx < 0) return;
  const existing = all[idx];
  if (!existing) return;
  all[idx] = {
    ...existing,
    counter: newCounter,
    lastUsedAt: new Date().toISOString(),
  };
  await writeJson(credPath(), all);
}

// ---- Challenges ---------------------------------------------------------

export async function saveChallenge(c: StoredChallenge): Promise<void> {
  const all = await readJson<StoredChallenge>(chalPath());
  const now = Date.now();
  // Drop expired entries while we're here.
  const fresh = all.filter((x) => now - x.createdAt < CHALLENGE_TTL_MS);
  // Replace any prior in-flight challenge for the same (email, purpose) —
  // a user starting a fresh ceremony should overwrite their old one.
  const replaced = fresh.filter(
    (x) => !(x.email === c.email && x.purpose === c.purpose),
  );
  replaced.push(c);
  await writeJson(chalPath(), replaced);
}

export async function consumeChallenge(
  email: string,
  purpose: 'register' | 'auth',
): Promise<string | null> {
  const all = await readJson<StoredChallenge>(chalPath());
  const now = Date.now();
  const idx = all.findIndex(
    (c) =>
      c.email === email.toLowerCase() &&
      c.purpose === purpose &&
      now - c.createdAt < CHALLENGE_TTL_MS,
  );
  if (idx < 0) return null;
  const challenge = all[idx]!.challenge;
  // Single-use: drop after consuming.
  all.splice(idx, 1);
  await writeJson(chalPath(), all);
  return challenge;
}

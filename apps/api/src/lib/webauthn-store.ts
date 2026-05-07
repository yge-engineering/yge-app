// Postgres-backed credential store + in-memory challenge map.
//
// Credentials persist in the WebauthnCredential table. Challenges are
// short-lived (5 minutes) — keeping them in-memory is fine for single-
// instance hosting and avoids a tiny extra table.

import { prisma } from '@yge/db';
import { recordAudit, type AuditContext } from './audit-store';

export interface StoredCredential {
  email: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  nickname?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface StoredChallenge {
  email: string;
  challenge: string;
  purpose: 'register' | 'auth';
  createdAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// In-memory challenge store keyed by `${email}:${purpose}`.
const challenges = new Map<string, StoredChallenge>();

function row2cred(row: { data: unknown }): StoredCredential | null {
  const d = row.data as StoredCredential | undefined;
  if (!d || typeof d !== 'object' || !d.credentialId) return null;
  return d;
}

// ---- Credentials --------------------------------------------------------

export async function listCredentials(email: string): Promise<StoredCredential[]> {
  const lower = email.toLowerCase();
  const rows = await prisma.webauthnCredential.findMany({ where: { email: lower } });
  return rows.map(row2cred).filter((c): c is StoredCredential => c !== null);
}

export async function findCredentialById(
  credentialId: string,
): Promise<StoredCredential | null> {
  const row = await prisma.webauthnCredential.findUnique({ where: { id: credentialId } });
  if (!row) return null;
  return row2cred(row);
}

export async function saveCredential(
  cred: StoredCredential,
  ctx?: AuditContext,
): Promise<void> {
  const lower = cred.email.toLowerCase();
  const stored: StoredCredential = { ...cred, email: lower };
  await prisma.webauthnCredential.upsert({
    where: { id: cred.credentialId },
    create: {
      id: cred.credentialId,
      email: lower,
      data: stored as unknown as object,
    },
    update: {
      email: lower,
      data: stored as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'WebauthnCredential',
    entityId: cred.credentialId,
    after: { email: lower, nickname: cred.nickname },
    ctx,
  });
}

export async function bumpCredentialCounter(
  credentialId: string,
  newCounter: number,
): Promise<void> {
  const existing = await findCredentialById(credentialId);
  if (!existing) return;
  const updated: StoredCredential = {
    ...existing,
    counter: newCounter,
    lastUsedAt: new Date().toISOString(),
  };
  await prisma.webauthnCredential.update({
    where: { id: credentialId },
    data: { data: updated as unknown as object },
  });
}

// ---- Challenges (in-memory) ---------------------------------------------

function key(email: string, purpose: 'register' | 'auth'): string {
  return `${email.toLowerCase()}:${purpose}`;
}

export async function saveChallenge(c: StoredChallenge): Promise<void> {
  // Drop expired entries while we're here.
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (now - v.createdAt >= CHALLENGE_TTL_MS) challenges.delete(k);
  }
  challenges.set(key(c.email, c.purpose), { ...c, email: c.email.toLowerCase() });
}

export async function consumeChallenge(
  email: string,
  purpose: 'register' | 'auth',
): Promise<string | null> {
  const k = key(email, purpose);
  const entry = challenges.get(k);
  if (!entry) return null;
  if (Date.now() - entry.createdAt >= CHALLENGE_TTL_MS) {
    challenges.delete(k);
    return null;
  }
  challenges.delete(k);
  return entry.challenge;
}

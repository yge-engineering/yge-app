// Postgres-backed store for calendar share tokens.
// One token per email; rotating issues a new token + invalidates the old.

import { randomBytes } from 'node:crypto';
import { getRequestCompanyId } from './request-context';
import { prisma } from '@yge/db';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

interface StoredToken {
  email: string;
  token: string;
  issuedAt: string;
}

function rowId(token: string): string {
  return `cst-${token.slice(0, 12)}`;
}

export async function getOrCreateShareToken(email: string): Promise<string> {
  const norm = email.toLowerCase();
  // Look for an existing un-expired token by scanning the JSON data
  // column. List is small (one per portal user) so a full scan is fine.
  const rows = await prisma.calendarShareToken.findMany({
    where: { companyId: companyId(), expiresAt: { gt: new Date() } },
  });
  for (const r of rows) {
    const data = r.data as unknown as StoredToken;
    if (data.email === norm) return data.token;
  }
  const token = randomBytes(24).toString('hex');
  const stored: StoredToken = {
    email: norm,
    token,
    issuedAt: new Date().toISOString(),
  };
  // Tokens never really expire in Phase 1; we set expiresAt 100 years
  // out so the DB scan above filters out genuinely-rotated rows.
  const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
  await prisma.calendarShareToken.create({
    data: {
      id: rowId(token),
      companyId: companyId(),
      expiresAt: farFuture,
      data: stored as unknown as object,
    },
  });
  return token;
}

export async function emailForShareToken(token: string): Promise<string | null> {
  const rows = await prisma.calendarShareToken.findMany({
    where: { companyId: companyId(), expiresAt: { gt: new Date() } },
  });
  for (const r of rows) {
    const data = r.data as unknown as StoredToken;
    if (data.token === token) return data.email;
  }
  return null;
}

export async function rotateShareToken(email: string): Promise<string> {
  const norm = email.toLowerCase();
  // Expire any active tokens for this email.
  const rows = await prisma.calendarShareToken.findMany({
    where: { companyId: companyId(), expiresAt: { gt: new Date() } },
  });
  for (const r of rows) {
    const data = r.data as unknown as StoredToken;
    if (data.email === norm) {
      await prisma.calendarShareToken.update({
        where: { id: r.id },
        data: { expiresAt: new Date() },
      });
    }
  }
  // Issue a fresh one.
  return getOrCreateShareToken(email);
}

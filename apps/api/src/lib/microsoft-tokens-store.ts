// Postgres-backed store for Microsoft OAuth tokens.

import { prisma } from '@yge/db';

interface StoredToken {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  issuedAt: string;
}

function row2tok(row: { data: unknown }): StoredToken {
  return row.data as unknown as StoredToken;
}

export async function getMicrosoftToken(email: string): Promise<StoredToken | null> {
  const norm = email.toLowerCase();
  const row = await prisma.microsoftToken.findUnique({ where: { email: norm } });
  return row ? row2tok(row) : null;
}

export async function listMicrosoftTokens(): Promise<StoredToken[]> {
  const rows = await prisma.microsoftToken.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2tok);
}

export async function saveMicrosoftToken(
  email: string,
  data: Omit<StoredToken, 'email' | 'issuedAt'> & { issuedAt?: string },
): Promise<StoredToken> {
  const norm = email.toLowerCase();
  const existing = await prisma.microsoftToken.findUnique({ where: { email: norm } });
  const issuedAt = data.issuedAt ?? (existing ? row2tok(existing).issuedAt : new Date().toISOString());
  const next: StoredToken = {
    email: norm,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
    issuedAt,
  };
  await prisma.microsoftToken.upsert({
    where: { email: norm },
    create: {
      id: `mst-${norm.replace(/[^a-z0-9]/g, '').slice(0, 24)}`,
      email: norm,
      data: next as unknown as object,
    },
    update: { data: next as unknown as object },
  });
  return next;
}

export async function deleteMicrosoftToken(email: string): Promise<boolean> {
  const norm = email.toLowerCase();
  const row = await prisma.microsoftToken.findUnique({ where: { email: norm } });
  if (!row) return false;
  await prisma.microsoftToken.delete({ where: { email: norm } });
  return true;
}

export type { StoredToken };

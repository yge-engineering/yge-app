// Postgres-backed store for SSO handoff tokens.
// Single-use, 60s TTL. Bridges OAuth callback (API) → web session.

import { randomBytes } from 'node:crypto';
import { prisma } from '@yge/db';

const TTL_MS = 60_000;

interface Handoff {
  token: string;
  email: string;
  createdAt: number;
  consumedAt?: number;
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createHandoff(email: string): Promise<string> {
  const token = newToken();
  const stored: Handoff = {
    token,
    email: email.trim().toLowerCase(),
    createdAt: Date.now(),
  };
  await prisma.ssoHandoff.create({
    data: {
      id: `sso-${token.slice(0, 16)}`,
      expiresAt: new Date(Date.now() + TTL_MS),
      data: stored as unknown as object,
    },
  });
  return token;
}

export async function consumeHandoff(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;
  const rows = await prisma.ssoHandoff.findMany({
    where: { expiresAt: { gt: new Date() } },
  });
  for (const r of rows) {
    const data = r.data as unknown as Handoff;
    if (data.token === token && !data.consumedAt) {
      const now = Date.now();
      if (now - data.createdAt > TTL_MS) return null;
      const consumed: Handoff = { ...data, consumedAt: now };
      await prisma.ssoHandoff.update({
        where: { id: r.id },
        data: { data: consumed as unknown as object },
      });
      return data.email;
    }
  }
  return null;
}

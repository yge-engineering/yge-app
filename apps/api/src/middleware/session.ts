// Session-cookie auth middleware.
//
// Plain English: Express reads the same `yge-session` cookie the
// web sets on sign-in, verifies its HMAC signature with the shared
// YGE_SESSION_SECRET, and stashes the user on req.ygeUser so
// downstream handlers and the tenant middleware can use it as the
// trusted source instead of the X-YGE-Actor-User header.
//
// Phase-1 rollout: NOT enforcing yet. When the cookie is missing or
// unsigned (legacy format) we log a single warning per process and
// fall through; the existing X-YGE-Actor-User header path still
// works. A future commit flips strict mode on.

import type { Request, RequestHandler } from 'express';
import { prisma } from '@yge/db';
import { verifySession } from '../lib/session-cookie';
import { logger } from '../lib/logger';

const COOKIE_NAME = 'yge-session';

export interface YgeSessionUser {
  email: string;
  name: string;
  role: string;
}

// Local cast shape — Express's Request type via @types/express doesn't
// merge cleanly with our `.d.ts` augmentation under pnpm's nested
// node_modules. We mutate req.ygeUser by widening the type here
// rather than fighting tsc's module-graph layout.
interface YgeRequestExtras {
  ygeUser?: YgeSessionUser | null;
  ygeUserSigned?: boolean;
  /** Multi-tenant: derived from the signed-in user's PortalUser row
   *  by sessionAuthMiddleware. When set, tenant middleware prefers
   *  it over the legacy X-YGE-Company header. */
  ygeUserCompanyId?: string | null;
}

function sessionSecret(): string {
  return process.env.YGE_SESSION_SECRET ?? '';
}

function readCookie(req: Request, name: string): string | null {
  // We don't pull in cookie-parser; Express's req.headers.cookie is
  // a single string we can hand-parse for the one cookie we care
  // about. Keeps the dep surface small.
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(p.slice(eq + 1).trim());
  }
  return null;
}

let warnedAboutMissingSecret = false;
function warnOnce(): void {
  if (warnedAboutMissingSecret) return;
  warnedAboutMissingSecret = true;
  logger.warn(
    'YGE_SESSION_SECRET is not set — session cookies are accepted unsigned. ' +
      'Set the env var to a long random string in production.',
  );
}

export const sessionAuthMiddleware: RequestHandler = async (req, _res, next) => {
  const extras = req as unknown as YgeRequestExtras;
  const raw = readCookie(req, COOKIE_NAME);
  if (!raw) {
    extras.ygeUser = null;
    extras.ygeUserSigned = false;
    extras.ygeUserCompanyId = null;
    return next();
  }
  const secret = sessionSecret();
  if (!secret) warnOnce();

  const verified = verifySession<YgeSessionUser>(raw, secret);
  if (verified.valid && verified.payload) {
    const p = verified.payload;
    if (
      typeof p.email === 'string' &&
      typeof p.name === 'string' &&
      typeof p.role === 'string'
    ) {
      extras.ygeUser = p;
      extras.ygeUserSigned = verified.signed;
      // Multi-tenant derivation: look up the PortalUser row by
      // email *across all tenants* (companyId not yet known) to
      // get their tenant. We tolerate a miss → null → fallback to
      // X-YGE-Company header or DEFAULT_COMPANY_ID downstream.
      try {
        const row = await prisma.portalUser.findFirst({
          where: { email: p.email.trim().toLowerCase(), deletedAt: null },
          select: { companyId: true },
        });
        extras.ygeUserCompanyId = row?.companyId ?? null;
      } catch {
        extras.ygeUserCompanyId = null;
      }
    } else {
      extras.ygeUser = null;
      extras.ygeUserSigned = false;
      extras.ygeUserCompanyId = null;
    }
  } else {
    extras.ygeUser = null;
    extras.ygeUserSigned = false;
    extras.ygeUserCompanyId = null;
  }
  return next();
};

// Tenant-resolution middleware.
//
// Phase 1 (single-tenant) reads X-YGE-Company / DEFAULT_COMPANY_ID
// and seeds the per-request context. Phase 2 multi-tenant will
// replace the header read with a real auth lookup (session cookie
// → user → user.companyId).

import type { RequestHandler } from 'express';
import { runWithContext } from '../lib/request-context';

interface YgeRequestExtras {
  ygeUser?: { email: string; name: string; role: string } | null;
  ygeUserSigned?: boolean;
  ygeUserCompanyId?: string | null;
}

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

export const tenantMiddleware: RequestHandler = (req, res, next) => {
  const extras = req as unknown as YgeRequestExtras;
  // Tenant priority:
  //   1. Verified session cookie's PortalUser.companyId — true
  //      multi-tenant signal, only present after sign-in
  //   2. X-YGE-Company header — legacy backstop for un-authed tooling
  //   3. DEFAULT_COMPANY_ID — single-tenant launch fallback
  const headerCompany = req.header('X-YGE-Company');
  const companyId =
    (extras.ygeUserSigned && extras.ygeUserCompanyId) ||
    headerCompany?.trim() ||
    DEFAULT_COMPANY_ID;
  // Actor priority: verified session cookie wins over the legacy
  // X-YGE-Actor-User header. Session middleware runs before us and
  // sets req.ygeUser; when it's present + HMAC-signed we trust the
  // email it carries. Header is the fallback for unauthenticated
  // tooling and during the rollout window.
  const actorUserId =
    (extras.ygeUserSigned && extras.ygeUser?.email) ||
    req.header('X-YGE-Actor-User')?.trim() ||
    null;
  const ipAddress =
    (req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? req.ip) || null;
  const userAgent = req.header('User-Agent') || null;

  // AsyncLocalStorage's `run` propagates through awaits in the rest
  // of the request lifecycle; calling next() inside it puts every
  // downstream handler under the same context.
  runWithContext(
    { companyId, actorUserId, ipAddress, userAgent },
    () => {
      next();
    },
  );
};

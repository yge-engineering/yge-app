// /api/whoami — return the current session's user + tenant.
//
// Plain English: client calls this to figure out who Express thinks
// is signed in. Returns { user: null } when there's no cookie or
// the cookie is invalid; otherwise returns the user payload plus a
// `signed` flag (false for legacy unsigned cookies) and the tenant
// the user resolved to. The web header uses it for the "signed in
// as X" badge; integration tests use it to verify the auth flow.

import { Router } from 'express';

export const whoamiRouter = Router();

interface YgeRequestExtras {
  ygeUser?: { email: string; name: string; role: string } | null;
  ygeUserSigned?: boolean;
  ygeUserCompanyId?: string | null;
}

whoamiRouter.get('/', (req, res) => {
  const extras = req as unknown as YgeRequestExtras;
  return res.json({
    user: extras.ygeUser ?? null,
    signed: extras.ygeUserSigned ?? false,
    companyId: extras.ygeUserCompanyId ?? null,
  });
});

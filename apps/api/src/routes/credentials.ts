// Credential routes — first-time password setup + sign-in verify.
//
// Plain English: when a seeded user (Ryan, Brook) signs in, the web's
// login server action POSTs here to either set a brand-new password
// (first time) or verify the typed password against the stored hash
// (subsequent sign-ins). The web app keeps the seeded-user allowlist;
// this API just stores/checks credentials by email.
//
// Defense in depth: the API also rejects unknown emails so a
// misconfigured web (or a direct curl) can't fill the credentials
// store with junk.

import { Router } from 'express';
import { z } from 'zod';
import {
  hasPassword,
  setPassword,
  verifyPassword,
} from '../lib/credentials-store';

export const credentialsRouter = Router();

// Mirror of the web's seeded-user list. Keeps the two in sync until we
// move auth onto Supabase. If you add a user here, also add them in
// apps/web/src/lib/auth.ts.
const ALLOWED_EMAILS = new Set<string>([
  'ryoung@youngge.com',
  'brookyoung@youngge.com',
]);

function isAllowed(email: string): boolean {
  return ALLOWED_EMAILS.has(email.toLowerCase());
}

// ---- GET /api/credentials/has-password ---------------------------------

const HasPasswordQuery = z.object({
  email: z.string().email().max(120),
});

credentialsRouter.get('/has-password', async (req, res, next) => {
  try {
    const parsed = HasPasswordQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const { email } = parsed.data;
    if (!isAllowed(email)) {
      // Don't leak whether the email is on the allowlist — pretend
      // every unknown email simply has no password yet. The web's
      // own allowlist will reject it at sign-in time.
      return res.json({ hasPassword: false });
    }
    return res.json({ hasPassword: await hasPassword(email) });
  } catch (err) {
    next(err);
  }
});

// ---- POST /api/credentials/set-password --------------------------------

const SetPasswordBody = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(120),
});

credentialsRouter.post('/set-password', async (req, res, next) => {
  try {
    const parsed = SetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;
    if (!isAllowed(email)) {
      return res.status(403).json({ error: 'Not on access list' });
    }
    if (await hasPassword(email)) {
      // First-time-only setup. Use a separate "change password" flow
      // (not yet built) for resets.
      return res
        .status(409)
        .json({ error: 'Password already set; use change-password to reset' });
    }
    await setPassword(email, password);
    return res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---- POST /api/credentials/verify --------------------------------------

const VerifyBody = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(120),
});

credentialsRouter.post('/verify', async (req, res, next) => {
  try {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;
    if (!isAllowed(email)) {
      return res.json({ valid: false });
    }
    const valid = await verifyPassword(email, password);
    return res.json({ valid });
  } catch (err) {
    next(err);
  }
});

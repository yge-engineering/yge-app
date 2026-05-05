// Credential routes — first-time password setup + sign-in verify.
//
// Plain English: when a portal user signs in, the web's login server
// action POSTs here to either set a brand-new password (first time)
// or verify the typed password against the stored hash (subsequent
// sign-ins). The allowlist is the portal-users store — newly-invited
// users via /admin/portal-users are recognized immediately. Disabled
// users are rejected before the password layer runs.
//
// Defense in depth: the API rejects unknown emails so a misconfigured
// web (or a direct curl) can't fill the credentials store with junk.

import { Router } from 'express';
import { z } from 'zod';
import {
  clearPassword,
  hasPassword,
  setPassword,
  verifyPassword,
} from '../lib/credentials-store';
import {
  getPortalUserByEmail,
  recordPortalUserLogin,
} from '../lib/portal-users-store';

export const credentialsRouter = Router();

/** True iff `email` belongs to an enabled portal user. Replaces the
 *  legacy hardcoded allowlist — newly-invited users via
 *  /admin/portal-users are now picked up automatically. Disabled
 *  users are rejected here before the password layer runs. */
async function isAllowed(email: string): Promise<boolean> {
  const u = await getPortalUserByEmail(email);
  return u !== null && !u.disabled;
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
    if (!(await isAllowed(email))) {
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
    if (!(await isAllowed(email))) {
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

// ---- POST /api/credentials/change-password -----------------------------

const ChangePasswordBody = z.object({
  email: z.string().email().max(120),
  oldPassword: z.string().min(1).max(120),
  newPassword: z.string().min(8).max(120),
});

credentialsRouter.post('/change-password', async (req, res, next) => {
  try {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const { email, oldPassword, newPassword } = parsed.data;
    if (!(await isAllowed(email))) {
      return res.status(403).json({ error: 'Not on access list' });
    }
    const ok = await verifyPassword(email, oldPassword);
    if (!ok) {
      return res.status(403).json({ error: 'Current password is wrong' });
    }
    if (newPassword === oldPassword) {
      return res
        .status(400)
        .json({ error: 'New password must differ from the current one' });
    }
    await setPassword(email, newPassword);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---- POST /api/credentials/clear ---------------------------------------
//
// Admin path: Brook forgets her password, Ryan clicks "Reset password"
// on /admin/portal-users → that calls this endpoint. The credential
// row is wiped so the next sign-in forces the create-password flow.
// Caller authorization is the web's own gate (the Reset button is
// only on /admin/portal-users which is portalUsers:manage gated);
// this route still confirms the email is on the access list so a
// stray curl can't blow away a non-portal-user's password.

const ClearBody = z.object({
  email: z.string().email().max(120),
});

credentialsRouter.post('/clear', async (req, res, next) => {
  try {
    const parsed = ClearBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const { email } = parsed.data;
    if (!(await isAllowed(email))) {
      return res.status(403).json({ error: 'Not on access list' });
    }
    const cleared = await clearPassword(email);
    return res.json({ cleared });
  } catch (err) {
    next(err);
  }
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
    // Rate limit: 8 failures per (ip, email) in 15 min → 15-min lockout.
    // Configurable via LOGIN_MAX_FAILURES / LOGIN_WINDOW_MS / LOGIN_LOCKOUT_MS.
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';
    const lockoutModule = await import('../lib/login-rate-limit');
    const lock = lockoutModule.checkLoginAllowed(ip, email);
    if (lock) {
      const retryAfterSec = Math.ceil(lock.retryAfterMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Too many failed sign-in attempts. Try again later.',
        retryAfterSec,
      });
    }
    if (!(await isAllowed(email))) {
      lockoutModule.recordLoginFailure(ip, email);
      return res.json({ valid: false });
    }
    const valid = await verifyPassword(email, password);
    if (valid) {
      lockoutModule.recordLoginSuccess(ip, email);
      // Update lastLoginAt + hasPassword on the portal-user row so
      // /admin/portal-users shows "X min ago" right after sign-in.
      // Best-effort — we never block the sign-in on the bookkeeping
      // failing.
      void recordPortalUserLogin(email).catch(() => {});
    } else {
      lockoutModule.recordLoginFailure(ip, email);
    }
    return res.json({ valid });
  } catch (err) {
    next(err);
  }
});

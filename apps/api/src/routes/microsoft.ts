// Microsoft OAuth + Graph routes.
//
//   GET  /api/microsoft/auth-url
//        → { url } : Microsoft sign-in URL the web redirects to.
//   GET  /api/microsoft/callback
//        → handles the OAuth redirect, swaps code → tokens, redirects
//          back to the web /files page with ?microsoft=connected.
//   GET  /api/microsoft/status?email=<email>
//        → { connected: bool, displayName? } : "is this user
//          connected" so the /files page can show "Connect" vs
//          "Connected as ___".
//   POST /api/microsoft/disconnect
//        → wipes the stored token row for the email.
//   GET  /api/microsoft/onedrive/recent?email=<email>
//        → { value: [{name, webUrl, lastModifiedDateTime}, ...] }
//          a sample Graph call to show the user something on the
//          /files page after they connect.

import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  buildAuthUrl,
  completeOAuthCallback,
  graphGet,
  isMicrosoftConfigured,
  SCOPES,
} from '../lib/microsoft-graph';
import {
  deleteMicrosoftToken,
  getMicrosoftToken,
} from '../lib/microsoft-tokens-store';
import { pollApInbox } from '../lib/ap-inbox-poller';
import {
  getApInboxLastRun,
  runApInboxPollOnce,
} from '../lib/ap-inbox-scheduler';
import {
  consumeHandoff,
  createHandoff,
} from '../lib/sso-handoff-store';
import { getPortalUserByEmail } from '../lib/portal-users-store';

export const microsoftRouter = Router();

function callbackUrl(req: Request): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.get('host') ??
    'yge-api.onrender.com';
  return `${proto}://${host}/api/microsoft/callback`;
}

function webOrigin(req: Request, fallback = 'https://app.youngge.com'): string {
  // Where to redirect the browser after callback — the YGE web origin.
  const fromQuery = typeof req.query.return === 'string' ? req.query.return : '';
  if (fromQuery && /^https:\/\/[a-z0-9.-]+\.(?:youngge\.com|vercel\.app)/i.test(fromQuery)) {
    return fromQuery;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? fallback;
}

microsoftRouter.get('/auth-url', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res
        .status(503)
        .json({ error: 'Microsoft OAuth not configured (server env vars missing)' });
    }
    // Embed the eventual return URL in the OAuth state param so the
    // callback can redirect back to wherever the user clicked Connect
    // from. Optional `purpose=signin` switches the callback to the
    // SSO sign-in flow (look up portal user, hand off to web for
    // session cookie) instead of the default "save tokens for OneDrive"
    // integration flow.
    const ret = typeof req.query.return === 'string' ? req.query.return : '';
    const purposeRaw = typeof req.query.purpose === 'string' ? req.query.purpose : '';
    const purpose = purposeRaw === 'signin' ? 'signin' : 'integration';
    const state = Buffer.from(
      JSON.stringify({ ret, purpose }),
    ).toString('base64url');
    const url = buildAuthUrl(callbackUrl(req), state);
    return res.json({ url, scopes: SCOPES, purpose });
  } catch (err) {
    next(err);
  }
});

microsoftRouter.get('/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const errParam = typeof req.query.error === 'string' ? req.query.error : '';
    const errDesc = typeof req.query.error_description === 'string' ? req.query.error_description : '';

    let parsedReturn = '';
    let purpose: 'integration' | 'signin' = 'integration';
    try {
      const decoded = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf-8'),
      ) as { ret?: string; purpose?: string };
      parsedReturn = decoded.ret ?? '';
      if (decoded.purpose === 'signin') purpose = 'signin';
    } catch {
      // bad state — fall through to default redirect
    }
    const baseUrl = webOrigin(req);
    if (errParam) {
      const errPath = purpose === 'signin' ? '/login' : '/files';
      const errKey = purpose === 'signin' ? 'sso' : 'microsoft';
      const u = new URL(errPath, baseUrl);
      u.searchParams.set(errKey, 'error');
      u.searchParams.set('reason', errDesc || errParam);
      return res.redirect(u.toString());
    }
    if (!code) {
      return res.status(400).type('text/plain').send('Missing OAuth code');
    }
    const { email, displayName } = await completeOAuthCallback(
      code,
      callbackUrl(req),
    );

    if (purpose === 'signin') {
      // Sign-in flow: don't keep the OneDrive tokens; just verify the
      // email is on the access list and hand off to the web with a
      // one-time token. Web exchanges it for the email and sets the
      // YGE session cookie on its own origin.
      const portalUser = await getPortalUserByEmail(email);
      if (!portalUser || portalUser.disabled) {
        const u = new URL('/login', baseUrl);
        u.searchParams.set('sso', 'denied');
        u.searchParams.set('email', email);
        return res.redirect(u.toString());
      }
      const handoff = await createHandoff(email);
      const u = new URL('/sso-complete', baseUrl);
      u.searchParams.set('token', handoff);
      if (parsedReturn) u.searchParams.set('return', parsedReturn);
      return res.redirect(u.toString());
    }

    // Integration flow (existing): tokens already saved by
    // completeOAuthCallback. Bounce to /files with the connected flag.
    const u = new URL(parsedReturn || '/files', baseUrl);
    u.searchParams.set('microsoft', 'connected');
    u.searchParams.set('email', email);
    if (displayName) u.searchParams.set('name', displayName);
    return res.redirect(u.toString());
  } catch (err) {
    // Surface the error in a redirect rather than a JSON 500 so the
    // user sees something useful in the web UI.
    const baseUrl = webOrigin(req);
    const u = new URL('/files', baseUrl);
    u.searchParams.set('microsoft', 'error');
    u.searchParams.set(
      'reason',
      err instanceof Error ? err.message.slice(0, 200) : 'callback failed',
    );
    return res.redirect(u.toString());
  }
});

// SSO handoff claim — web's /sso-complete page POSTs here from the
// server with the token; we return the email if the token is valid
// + unexpired + unconsumed. The web then sets its own YGE session
// cookie and redirects the browser to /dashboard.
const SsoClaimBody = z.object({
  token: z.string().min(16).max(256),
});
microsoftRouter.post('/sso-claim', async (req, res, next) => {
  try {
    const parsed = SsoClaimBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = await consumeHandoff(parsed.data.token);
    if (!email) {
      return res.status(404).json({ error: 'Token expired or unknown' });
    }
    return res.json({ email });
  } catch (err) {
    next(err);
  }
});

const StatusQuery = z.object({ email: z.string().email().max(120) });

microsoftRouter.get('/status', async (req, res, next) => {
  try {
    const parsed = StatusQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const tok = await getMicrosoftToken(parsed.data.email);
    return res.json({
      connected: tok !== null,
      ...(tok ? { issuedAt: tok.issuedAt, expiresAt: tok.expiresAt } : {}),
      configured: isMicrosoftConfigured(),
    });
  } catch (err) {
    next(err);
  }
});

const DisconnectBody = z.object({ email: z.string().email().max(120) });

microsoftRouter.post('/disconnect', async (req, res, next) => {
  try {
    const parsed = DisconnectBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const ok = await deleteMicrosoftToken(parsed.data.email);
    return res.json({ disconnected: ok });
  } catch (err) {
    next(err);
  }
});

interface OneDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: unknown;
}

// AP inbox poll — pull recent invoices out of the shared mailbox
// (default ap@youngge.com) and create draft AP invoice rows for each
// new message. Caller passes their email so the API uses their stored
// Microsoft tokens. Returns counts + list of created invoice ids.
const InboxPollBody = z.object({
  userEmail: z.string().email().max(120),
  mailbox: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

microsoftRouter.post('/ap-inbox-poll', async (req, res, next) => {
  try {
    const parsed = InboxPollBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const result = await pollApInbox({
      userEmail: parsed.data.userEmail,
      ...(parsed.data.mailbox ? { mailbox: parsed.data.mailbox } : {}),
      ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// Status endpoint: exposes the last auto-poll summary so the UI can
// render "last poll: 12 min ago · X new invoices". Read-only.
microsoftRouter.get('/ap-inbox-status', async (_req, res) => {
  const last = getApInboxLastRun();
  return res.json({ lastRun: last });
});

// Manual run-now: same as the per-user pull, but iterates every
// connected user. Useful when the office wants to flush the inbox
// without waiting for the next scheduled tick.
microsoftRouter.post('/ap-inbox-run-now', async (_req, res, next) => {
  try {
    const summary = await runApInboxPollOnce();
    return res.json({ summary });
  } catch (err) {
    next(err);
  }
});

microsoftRouter.get('/onedrive/recent', async (req, res, next) => {
  try {
    const parsed = StatusQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const data = await graphGet<{ value: OneDriveItem[] }>(
      parsed.data.email,
      '/me/drive/recent?$top=20',
    );
    return res.json({
      items: data.value.map((i) => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        lastModifiedDateTime: i.lastModifiedDateTime,
        size: i.size,
        kind: i.folder ? 'folder' : 'file',
        mimeType: i.file?.mimeType,
      })),
    });
  } catch (err) {
    next(err);
  }
});

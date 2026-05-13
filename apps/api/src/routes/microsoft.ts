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
  triageEmails,
  triageEmailsWithRaw,
  type EmailTriageMessage,
} from '../lib/email-triage';
import { listJobs } from '../lib/jobs-store';
import { listCustomers } from '../lib/customers-store';
import { matchEmailToJob, type EmailJobCandidateJob } from '@yge/shared';
import {
  ensureMailFolder,
  jobFolderName,
  moveMessage,
} from '../lib/microsoft-mail-folders';
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
// POST /api/microsoft/inbox-triage — fetch the most recent N emails
// for `email` and run each through the AI classifier. v1 is read-
// only; auto-file + draft-reply ship next.
microsoftRouter.post('/inbox-triage', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Body = z.object({
      email: z.string().email(),
      max: z.number().int().min(1).max(50).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const max = parsed.data.max ?? 25;

    interface GraphMessage {
      id: string;
      subject: string | null;
      bodyPreview: string | null;
      receivedDateTime: string;
      from?: { emailAddress?: { address?: string; name?: string } };
    }
    const path =
      `/me/messages?$top=${max}` +
      `&$select=id,subject,bodyPreview,receivedDateTime,from`;
    const graph = await graphGet<{ value: GraphMessage[] }>(
      parsed.data.email,
      path,
    );

    const messages: EmailTriageMessage[] = graph.value.map((m) => ({
      id: m.id,
      subject: m.subject ?? '(no subject)',
      fromAddress: m.from?.emailAddress?.address ?? 'unknown@unknown',
      fromName: m.from?.emailAddress?.name,
      bodyPreview: m.bodyPreview ?? '',
      receivedAtIso: m.receivedDateTime,
    }));

    const out = await triageEmailsWithRaw(messages);
    if (!out.items) {
      return res.status(502).json({
        error: out.error ?? 'AI returned an unparseable response',
        rawHead: out.rawHead,
      });
    }

    // Build the candidate-job list for the email→job matcher.
    const [jobs, customers] = await Promise.all([
      listJobs(),
      listCustomers(),
    ]);
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const candidates: EmailJobCandidateJob[] = jobs.map((j) => {
      // file-store Job has no customerId yet; the next iteration
      // wires that. For now we use ownerAgency as a fallback.
      const linked = (j as unknown as { customerId?: string }).customerId;
      const cust = linked ? customerById.get(linked) : undefined;
      return {
        id: j.id,
        projectName: j.projectName,
        customerLegalName: cust?.legalName ?? j.ownerAgency,
        customerDbaName: cust?.dbaName,
        customerEmail: cust?.email,
      };
    });

    // Map AI items back onto the source messages so the UI gets
    // subject + from + suggested-job in one shot.
    const itemById = new Map(out.items.map((i) => [i.messageId, i]));
    const enriched = messages.map((m) => {
      const tri = itemById.get(m.id);
      const match = matchEmailToJob(
        {
          subject: m.subject,
          fromAddress: m.fromAddress,
          bodyPreview: m.bodyPreview,
        },
        candidates,
      );
      const matchedJob =
        match.jobId
          ? jobs.find((j) => j.id === match.jobId)
          : undefined;
      return {
        id: m.id,
        subject: m.subject,
        fromAddress: m.fromAddress,
        fromName: m.fromName,
        receivedAtIso: m.receivedAtIso,
        category: tri?.category ?? 'OTHER',
        confidence: tri?.confidence ?? 'LOW',
        nextAction: tri?.nextAction ?? '(unclassified)',
        suggestedJob:
          match.jobId && matchedJob && match.confidence !== 'none'
            ? {
                jobId: match.jobId,
                projectName: matchedJob.projectName,
                confidence: match.confidence,
                reasons: match.reasons,
              }
            : null,
      };
    });

    return res.json({
      messages: enriched,
      promptVersion: out.promptVersion,
    });
  } catch (err) {
    next(err);
  }
});
// POST /api/microsoft/inbox-triage/file-to-job — move messages into
// per-job Outlook folders.
//
// Body: { email, items: [{ messageId, jobId }] }
// Returns: { moved, skipped, errors }
//
// Folder layout: Inbox/Jobs/<jobNumber projectName>. The folder is
// created on first move per job.
microsoftRouter.post('/inbox-triage/file-to-job', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Body = z.object({
      email: z.string().email(),
      items: z
        .array(
          z.object({
            messageId: z.string().min(1),
            jobId: z.string().min(1),
          }),
        )
        .min(1)
        .max(100),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const jobs = await listJobs();
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    const moved: Array<{ messageId: string; newMessageId?: string }> = [];
    const skipped: Array<{ messageId: string; reason: string }> = [];
    const errors: Array<{ messageId: string; reason: string }> = [];

    // Cache resolved folder ids so we don't ensureMailFolder for the
    // same job twice in one request.
    const folderCache = new Map<string, string>();

    for (const item of parsed.data.items) {
      const job = jobById.get(item.jobId);
      if (!job) {
        skipped.push({ messageId: item.messageId, reason: 'job not found' });
        continue;
      }
      try {
        let destinationId = folderCache.get(job.id);
        if (!destinationId) {
          // Use the trailing 8-char jobNumber from the id, matching
          // how the Postgres jobs-store derives it.
          const idMatch = job.id.match(/-([a-f0-9]{8})$/);
          const jobNumber = idMatch ? idMatch[1] : undefined;
          const folderName = jobFolderName({
            projectName: job.projectName,
            jobNumber,
          });
          destinationId = await ensureMailFolder(parsed.data.email, [
            'Jobs',
            folderName,
          ]);
          folderCache.set(job.id, destinationId);
        }
        const result = await moveMessage(
          parsed.data.email,
          item.messageId,
          destinationId,
        );
        if (result) {
          moved.push({
            messageId: item.messageId,
            newMessageId: result.newMessageId,
          });
        } else {
          skipped.push({
            messageId: item.messageId,
            reason: 'message gone or already moved',
          });
        }
      } catch (err) {
        errors.push({
          messageId: item.messageId,
          reason: (err as Error).message,
        });
      }
    }

    return res.json({ moved, skipped, errors });
  } catch (err) {
    next(err);
  }
});

// GET /api/microsoft/onedrive/job-folder?email=&jobNumber=&projectName=
// — resolve the existing OneDrive folder for this job. 404 if missing.
microsoftRouter.get('/onedrive/job-folder', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Q = z.object({
      email: z.string().email(),
      jobNumber: z.string().min(1).max(40),
      projectName: z.string().min(1).max(200),
    });
    const parsed = Q.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { email, jobNumber, projectName } = parsed.data;
    const { findByPath, jobFolderPath } = await import('../lib/onedrive');
    const path = jobFolderPath(jobNumber, projectName);
    const item = await findByPath(email, path);
    if (!item) return res.status(404).json({ error: 'Folder not yet created', path });
    return res.json({ webUrl: item.webUrl ?? null, itemId: item.id, path });
  } catch (err) {
    next(err);
  }
});

// POST /api/microsoft/onedrive/job-folder { email, jobNumber, projectName }
// — idempotently create the YGE Jobs/<job> folder tree.
microsoftRouter.post('/onedrive/job-folder', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Body = z.object({
      email: z.string().email(),
      jobNumber: z.string().min(1).max(40),
      projectName: z.string().min(1).max(200),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { email, jobNumber, projectName } = parsed.data;
    const { ensureFolderPath, jobFolderPath } = await import('../lib/onedrive');
    const basePath = jobFolderPath(jobNumber, projectName);
    const root = await ensureFolderPath(email, basePath);
    // Create the standard sub-folders YGE uses on every job.
    const subfolders = ['RFIs', 'Submittals', 'Photos', 'Daily Reports', 'Plans', 'CPRs', 'Lien Waivers', 'Change Orders'];
    for (const sub of subfolders) {
      await ensureFolderPath(email, basePath + '/' + sub);
    }
    return res.json({ webUrl: root.webUrl ?? null, itemId: root.id, path: basePath, subfolders });
  } catch (err) {
    next(err);
  }
});

// GET /api/microsoft/onedrive/browse?email=&parentItemId= — list
// children of a folder. Root if parentItemId omitted. Used by the
// <OneDrivePicker> UI component.
microsoftRouter.get('/onedrive/browse', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Q = z.object({
      email: z.string().email(),
      parentItemId: z.string().min(1).max(200).optional(),
    });
    const parsed = Q.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { listChildren } = await import('../lib/onedrive');
    const items = await listChildren(parsed.data.email, parsed.data.parentItemId, { top: 100 });
    return res.json({
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl ?? null,
        isFolder: Boolean(i.folder),
        size: i.size ?? 0,
        mimeType: i.file?.mimeType ?? null,
        lastModifiedDateTime: i.lastModifiedDateTime ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/microsoft/calendar/today?email=&date= — list today's
// Outlook calendar events for the user. Used by /morning-briefing.
// 'date' is optional yyyy-mm-dd (default = today UTC).
microsoftRouter.get('/calendar/today', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Q = z.object({
      email: z.string().email(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    const parsed = Q.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
    const startIso = date + 'T00:00:00';
    const endIso = date + 'T23:59:59';

    interface CalendarEvent {
      id: string;
      subject?: string;
      bodyPreview?: string;
      start?: { dateTime: string; timeZone: string };
      end?: { dateTime: string; timeZone: string };
      location?: { displayName?: string };
      isAllDay?: boolean;
      isCancelled?: boolean;
      webLink?: string;
      attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
    }
    try {
      const path = `/me/calendarview?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}&$select=id,subject,bodyPreview,start,end,location,isAllDay,isCancelled,webLink,attendees&$orderby=start/dateTime&$top=50`;
      const data = await graphGet<{ value: CalendarEvent[] }>(parsed.data.email, path);
      const events = data.value
        .filter((e) => !e.isCancelled)
        .map((e) => ({
          id: e.id,
          subject: e.subject ?? '(no subject)',
          bodyPreview: e.bodyPreview ?? null,
          startDateTime: e.start?.dateTime ?? null,
          endDateTime: e.end?.dateTime ?? null,
          location: e.location?.displayName ?? null,
          isAllDay: !!e.isAllDay,
          webLink: e.webLink ?? null,
          attendeeCount: e.attendees?.length ?? 0,
        }));
      return res.json({ events, date });
    } catch (err) {
      // Token may not have Calendars.ReadWrite scope yet — return
      // 403 with a hint so the UI can show "reconnect to enable
      // calendar".
      if (err instanceof Error && /forbidden|insufficient|consent|scope/i.test(err.message)) {
        return res.status(403).json({
          error: 'Calendar scope not granted. Disconnect + reconnect Microsoft 365 on /files.',
          needsReconsent: true,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});


// Calendar share routes — per-user iCal subscription URLs.
//
// Plain English: when Ryan or Brook clicks "Connect to Outlook" in
// the web UI, the client POSTs here to get (or mint) their personal
// share token. They paste the resulting URL into Outlook / Google /
// Apple's calendar-subscription box. Those clients pull the .ics
// feed on their own schedule.
//
// Endpoints:
//   POST /api/calendar-share/token   → { url }     (create-or-fetch)
//   POST /api/calendar-share/rotate  → { url }     (revoke + reissue)
//   GET  /api/calendar-share/feed/:token.ics      → text/calendar
//
// The token IS the auth — anyone with the URL can read the feed for
// that user. Rotate flow lets them revoke. The web's seeded-user
// allowlist guards token issuance so only YGE staff can subscribe.

import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  emailForShareToken,
  getOrCreateShareToken,
  rotateShareToken,
} from '../lib/calendar-share-tokens-store';
import { listCalendarEvents } from '../lib/calendar-events-store';
import { eventsToIcal } from '../lib/ical';
import { eventIncludesUser } from '@yge/shared';

export const calendarShareRouter = Router();

// Mirror of the seeded-user list. Keeps token issuance gated to
// known staff until we move to Supabase Auth.
const ALLOWED_EMAILS = new Set<string>([
  'ryoung@youngge.com',
  'brookyoung@youngge.com',
]);

function feedUrlForToken(req: Request, token: string): string {
  // Build an absolute URL so the web can hand it to the user as a
  // single copy-paste string. Render sets x-forwarded-* headers,
  // so prefer those.
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ??
    req.protocol ??
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.get('host') ??
    'yge-api.onrender.com';
  return `${proto}://${host}/api/calendar-share/feed/${token}.ics`;
}

const TokenBody = z.object({
  email: z.string().email().max(120),
});

calendarShareRouter.post('/token', async (req, res, next) => {
  try {
    const parsed = TokenBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Not on access list' });
    }
    const token = await getOrCreateShareToken(email);
    return res.json({ url: feedUrlForToken(req, token) });
  } catch (err) {
    next(err);
  }
});

calendarShareRouter.post('/rotate', async (req, res, next) => {
  try {
    const parsed = TokenBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      return res.status(403).json({ error: 'Not on access list' });
    }
    const token = await rotateShareToken(email);
    return res.json({ url: feedUrlForToken(req, token) });
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar-share/feed/:token.ics
calendarShareRouter.get('/feed/:tokenWithExt', async (req, res, next) => {
  try {
    const raw = req.params.tokenWithExt;
    const token = raw.endsWith('.ics') ? raw.slice(0, -4) : raw;
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(400).type('text/plain').send('Invalid token');
    }
    const email = await emailForShareToken(token);
    if (!email) {
      return res.status(404).type('text/plain').send('Feed not found');
    }
    // Wide window — past 6 months, future 18 months. Covers most
    // calendar clients' read range.
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 6);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 18);
    const all = await listCalendarEvents({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    const filtered = all.filter((e) => eventIncludesUser(e, email));
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host') ?? 'app.youngge.com';
    const ical = eventsToIcal(filtered, host, `YGE Calendar — ${email}`);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="yge-calendar-${email}.ics"`,
    );
    return res.send(ical);
  } catch (err) {
    next(err);
  }
});

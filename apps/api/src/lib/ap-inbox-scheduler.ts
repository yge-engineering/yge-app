// AP-inbox scheduler — periodically polls ap@youngge.com for every
// user connected to Microsoft 365, so vendor invoices arrive in
// /ap-invoices automatically without anyone clicking "Pull from ap@".
//
// Plain English: an in-process timer that wakes every N minutes,
// walks the list of users with stored Microsoft tokens, calls the
// inbox poller for each, and tracks the result in memory + on disk
// so the UI can show "last run: 12 min ago".
//
// Render keeps the API alive on the Standard tier, so a setInterval
// here is durable enough for Phase 1. The Phase 4 plan moves this
// to a real job queue (BullMQ / Trigger.dev) once the volume
// justifies the cost.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from './logger';
import { listMicrosoftTokens } from './microsoft-tokens-store';
import { pollApInbox } from './ap-inbox-poller';

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  perUser: {
    email: string;
    scanned: number;
    ingested: number;
    skipped: number;
    extracted: number;
    error?: string;
  }[];
}

let lastRun: RunSummary | null = null;
let timer: NodeJS.Timeout | null = null;
let inFlight = false;

function statusFile(): string {
  return path.resolve(
    process.env.AP_INBOX_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'ap-inbox'),
    'scheduler-last-run.json',
  );
}

async function persistLastRun(summary: RunSummary): Promise<void> {
  try {
    await fs.mkdir(path.dirname(statusFile()), { recursive: true });
    await fs.writeFile(statusFile(), JSON.stringify(summary, null, 2), 'utf8');
  } catch {
    // Persistence is best-effort. The in-memory copy is still served.
  }
}

async function loadLastRun(): Promise<void> {
  try {
    const raw = await fs.readFile(statusFile(), 'utf8');
    lastRun = JSON.parse(raw) as RunSummary;
  } catch {
    // No prior run; that's fine.
  }
}

export async function runApInboxPollOnce(): Promise<RunSummary> {
  if (inFlight) {
    // Defensive — if a prior run is still going just return its
    // (incomplete) summary stub.
    return (
      lastRun ?? {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        perUser: [],
      }
    );
  }
  inFlight = true;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const perUser: RunSummary['perUser'] = [];
  try {
    const tokens = await listMicrosoftTokens();
    for (const t of tokens) {
      try {
        const result = await pollApInbox({ userEmail: t.email });
        perUser.push({
          email: t.email,
          scanned: result.scanned,
          ingested: result.ingested,
          skipped: result.skipped,
          extracted: result.extracted,
        });
      } catch (err) {
        perUser.push({
          email: t.email,
          scanned: 0,
          ingested: 0,
          skipped: 0,
          extracted: 0,
          error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
        });
      }
    }
  } finally {
    inFlight = false;
  }
  const summary: RunSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    perUser,
  };
  lastRun = summary;
  await persistLastRun(summary);
  const ingested = perUser.reduce((acc, p) => acc + p.ingested, 0);
  if (ingested > 0) {
    logger.info(
      { ingested, users: perUser.length, durationMs: summary.durationMs },
      'AP inbox auto-poll: ingested new invoices',
    );
  }
  return summary;
}

export function getApInboxLastRun(): RunSummary | null {
  return lastRun;
}

/** Start the periodic poller. Default interval 30 min, configurable
 *  via AP_INBOX_POLL_INTERVAL_MS. Set to 0 to disable. The first
 *  run fires after a short startup delay so the API has a chance to
 *  finish booting before reaching out to Graph. */
export async function startApInboxScheduler(): Promise<void> {
  await loadLastRun();
  const intervalMs = Number.parseInt(
    process.env.AP_INBOX_POLL_INTERVAL_MS ?? '1800000',
    10,
  );
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger.info('AP inbox scheduler disabled (AP_INBOX_POLL_INTERVAL_MS=0).');
    return;
  }
  // Initial 60s grace period after boot.
  setTimeout(() => {
    void runApInboxPollOnce();
  }, 60_000);
  timer = setInterval(() => {
    void runApInboxPollOnce();
  }, intervalMs);
  logger.info(
    { intervalMs },
    'AP inbox scheduler started (polls ap@ for every connected user).',
  );
}

export function stopApInboxScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

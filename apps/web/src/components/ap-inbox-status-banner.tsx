'use client';

// ApInboxStatusBanner — small client island under the /ap-invoices
// header that surfaces the auto-poll status: when the cron last ran,
// how many invoices it ingested, and whether anything errored.
//
// Hits GET /api/microsoft/ap-inbox-status, refreshes every 60s.

import { useEffect, useState } from 'react';

interface PerUser {
  email: string;
  scanned: number;
  ingested: number;
  skipped: number;
  extracted: number;
  error?: string;
}
interface RunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  perUser: PerUser[];
}
interface Resp {
  lastRun: RunSummary | null;
}

interface Props {
  apiBaseUrl: string;
  /** When true, render an admin "Run now" button that triggers
   *  POST /api/microsoft/ap-inbox-run-now without waiting for the
   *  next scheduled tick. Default false — only owners want this. */
  showRunNow?: boolean;
}

function relWhen(iso: string): string {
  const d = new Date(iso);
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86_400)} d ago`;
}

export function ApInboxStatusBanner({ apiBaseUrl, showRunNow }: Props) {
  const [data, setData] = useState<RunSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/microsoft/ap-inbox-status`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const j = (await res.json()) as Resp;
      setData(j.lastRun);
    } catch {
      // ignore — banner is best-effort
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void load();
    const t = setInterval(() => {
      if (!cancelled) void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [apiBaseUrl]);

  async function runNow() {
    setRunningNow(true);
    try {
      await fetch(`${apiBaseUrl}/api/microsoft/ap-inbox-run-now`, {
        method: 'POST',
      });
      await load();
    } catch {
      // best-effort
    } finally {
      setRunningNow(false);
    }
  }

  if (!loaded) return null;
  if (!data) {
    return (
      <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Auto-poll has not run yet. The scheduler kicks off ~1 min after the
        API boots and again every 30 min after that. Connected Microsoft 365
        users get their ap@ mailbox checked.
      </div>
    );
  }
  const totalIngested = data.perUser.reduce((acc, p) => acc + p.ingested, 0);
  const totalScanned = data.perUser.reduce((acc, p) => acc + p.scanned, 0);
  const errored = data.perUser.filter((p) => p.error);
  const tone =
    errored.length > 0
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : totalIngested > 0
        ? 'border-green-300 bg-green-50 text-green-900'
        : 'border-gray-200 bg-gray-50 text-gray-700';
  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${tone}`}
    >
      <span>
        Auto-poll last ran <strong>{relWhen(data.finishedAt)}</strong> ·{' '}
        {data.perUser.length} connected user{data.perUser.length === 1 ? '' : 's'} ·{' '}
        {totalIngested} new invoice{totalIngested === 1 ? '' : 's'} from{' '}
        {totalScanned} message{totalScanned === 1 ? '' : 's'}
        {errored.length > 0 && (
          <span> · ⚠ {errored.length} error{errored.length === 1 ? '' : 's'}</span>
        )}
        .
      </span>
      {showRunNow && (
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={runningNow}
          className="rounded border border-current bg-white/60 px-2 py-0.5 font-medium hover:bg-white disabled:opacity-50"
        >
          {runningNow ? 'Polling…' : 'Run now (all users)'}
        </button>
      )}
    </div>
  );
}

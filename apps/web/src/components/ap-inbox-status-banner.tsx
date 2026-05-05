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
}

function relWhen(iso: string): string {
  const d = new Date(iso);
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86_400)} d ago`;
}

export function ApInboxStatusBanner({ apiBaseUrl }: Props) {
  const [data, setData] = useState<RunSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/microsoft/ap-inbox-status`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = (await res.json()) as Resp;
        if (cancelled) return;
        setData(j.lastRun);
      } catch {
        // ignore — banner is best-effort
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [apiBaseUrl]);

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
    <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      Auto-poll last ran <strong>{relWhen(data.finishedAt)}</strong> ·{' '}
      {data.perUser.length} connected user{data.perUser.length === 1 ? '' : 's'} ·{' '}
      {totalIngested} new invoice{totalIngested === 1 ? '' : 's'} from{' '}
      {totalScanned} message{totalScanned === 1 ? '' : 's'}
      {errored.length > 0 && (
        <span> · ⚠ {errored.length} error{errored.length === 1 ? '' : 's'}</span>
      )}
      .
    </div>
  );
}

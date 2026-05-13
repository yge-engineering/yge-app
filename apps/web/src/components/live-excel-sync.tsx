// Polling-based live sync for an estimate's OneDrive workbook.
//
// When toggled ON, polls /api/estimates/:id/excel/pull every 30s. The
// pull endpoint cheap-skips when the file hasn't changed. When it
// does pick up changes, the page reloads to show new totals.

'use client';

import { useEffect, useRef, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

type Status = 'idle' | 'syncing' | 'in-sync' | 'pulling' | 'error';

export function LiveExcelSync({ estimateId }: { estimateId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<string | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchEmail(): Promise<string | null> {
    if (emailRef.current) return emailRef.current;
    try {
      const res = await fetch(`${apiBaseUrl()}/api/me`, { cache: 'no-store' });
      if (!res.ok) return null;
      const body = (await res.json()) as { email?: string };
      if (body.email) emailRef.current = body.email;
      return emailRef.current;
    } catch {
      return null;
    }
  }

  async function poll() {
    const email = await fetchEmail();
    if (!email) {
      setError("Couldn't read your email from session.");
      setStatus('error');
      return;
    }
    setStatus('syncing');
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/estimates/${estimateId}/excel/pull`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      const body = (await res.json()) as {
        skipped?: boolean;
        bidItems?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Sync failed (${res.status})`);
        setStatus('error');
        return;
      }
      setError(null);
      setLastSyncAt(new Date());
      if (body.skipped) {
        setStatus('in-sync');
      } else {
        // Real update happened. Reload to show new values.
        setStatus('pulling');
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!enabled) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    void poll();
    tickRef.current = setInterval(() => void poll(), 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, estimateId]);

  function statusLabel(): string {
    if (!enabled) return 'Live sync off';
    if (status === 'syncing') return '● Syncing…';
    if (status === 'pulling') return '↻ Excel changed — pulling…';
    if (status === 'error') return '⚠ Sync error';
    if (status === 'in-sync' && lastSyncAt) {
      const secs = Math.round((Date.now() - lastSyncAt.getTime()) / 1000);
      return `✓ in sync · ${secs}s ago`;
    }
    return 'Starting…';
  }

  const pillTone =
    !enabled
      ? 'border-gray-300 bg-gray-50 text-gray-700'
      : status === 'error'
        ? 'border-red-300 bg-red-50 text-red-800'
        : status === 'pulling'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-green-300 bg-green-50 text-green-800';

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Live sync with OneDrive (poll every 30s)
      </label>
      <span
        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${pillTone}`}
      >
        {statusLabel()}
      </span>
      {error ? (
        <span className="text-[11px] text-red-700">{error}</span>
      ) : null}
    </div>
  );
}

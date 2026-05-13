// Live two-way sync indicator for an estimate ↔ its OneDrive workbook.
//
// Polls /excel/sync-status every 30s. Reacts:
//   - 'in-sync': green pill, no action
//   - 'excel-newer': auto-fires the pull endpoint
//   - 'app-newer': amber, surfaces a "↑ Push to Excel" button
//   - 'conflict': red, surfaces both pull + push (user picks)
//   - 'no-file': hidden / user needs to Save-to-OneDrive first

'use client';

import { useEffect, useRef, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

type SyncState = 'in-sync' | 'excel-newer' | 'app-newer' | 'conflict' | 'no-file' | 'unknown';

export function LiveExcelSync({ estimateId }: { estimateId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<SyncState>('unknown');
  const [lastCheckAt, setLastCheckAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function checkStatus(): Promise<SyncState | null> {
    const email = await fetchEmail();
    if (!email) {
      setError("Couldn't read your email from session.");
      return null;
    }
    const res = await fetch(
      `${apiBaseUrl()}/api/estimates/${estimateId}/excel/sync-status?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Sync status failed (${res.status})`);
      return null;
    }
    const body = (await res.json()) as { state: SyncState };
    setLastCheckAt(new Date());
    setError(null);
    setState(body.state);
    return body.state;
  }

  async function doPull() {
    const email = await fetchEmail();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/estimates/${estimateId}/excel/pull?force=1`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Pull failed (${res.status})`);
        return;
      }
      // Reload to render the new estimate data.
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doPush() {
    const email = await fetchEmail();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/estimates/${estimateId}/excel/save-to-onedrive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Push failed (${res.status})`);
        return;
      }
      await checkStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tick() {
    const s = await checkStatus();
    if (s === 'excel-newer') {
      await doPull();
    }
  }

  useEffect(() => {
    if (!enabled) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    void tick();
    tickRef.current = setInterval(() => void tick(), 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, estimateId]);

  function statusLabel(): string {
    if (!enabled) return 'Live sync off';
    if (busy) return '● Working…';
    if (state === 'unknown' && !lastCheckAt) return 'Starting…';
    if (state === 'in-sync') {
      const secs = lastCheckAt
        ? Math.round((Date.now() - lastCheckAt.getTime()) / 1000)
        : 0;
      return `✓ in sync · ${secs}s ago`;
    }
    if (state === 'excel-newer') return '↻ Excel newer — pulling…';
    if (state === 'app-newer') return '↑ App has unpushed changes';
    if (state === 'conflict') return '⚠ Conflict — both changed';
    if (state === 'no-file')
      return 'No workbook on OneDrive yet (use Save-to-OneDrive)';
    return 'Checking…';
  }

  function pillTone(): string {
    if (!enabled) return 'border-gray-300 bg-gray-50 text-gray-700';
    if (state === 'conflict') return 'border-red-300 bg-red-50 text-red-800';
    if (state === 'app-newer') return 'border-amber-300 bg-amber-50 text-amber-900';
    if (state === 'excel-newer') return 'border-amber-300 bg-amber-50 text-amber-900';
    if (state === 'in-sync') return 'border-green-300 bg-green-50 text-green-800';
    return 'border-gray-300 bg-gray-50 text-gray-700';
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Live sync with OneDrive
      </label>
      <span
        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${pillTone()}`}
      >
        {statusLabel()}
      </span>
      {enabled && (state === 'app-newer' || state === 'conflict') ? (
        <button
          type="button"
          onClick={() => void doPush()}
          disabled={busy}
          className="rounded-md border border-amber-600 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          ↑ Push to Excel
        </button>
      ) : null}
      {enabled && (state === 'excel-newer' || state === 'conflict') ? (
        <button
          type="button"
          onClick={() => void doPull()}
          disabled={busy}
          className="rounded-md border border-green-600 bg-white px-2 py-0.5 text-[11px] font-semibold text-green-800 hover:bg-green-100 disabled:opacity-50"
        >
          ↓ Pull from Excel
        </button>
      ) : null}
      {error ? <span className="text-[11px] text-red-700">{error}</span> : null}
    </div>
  );
}

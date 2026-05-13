// "↓ Download Excel" + "📁 Save to OneDrive" buttons for an estimate.

'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function EstimateExcelButtons({ estimateId }: { estimateId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<{ webUrl: string | null; path: string } | null>(null);
  const [pullBusy, setPullBusy] = useState(false);
  const [pullResult, setPullResult] = useState<unknown>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  async function pullFromOneDrive() {
    setPullBusy(true);
    setPullError(null);
    setPullResult(null);
    try {
      const meRes = await fetch(`${apiBaseUrl()}/api/me`, { cache: 'no-store' });
      let email = '';
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string };
        email = me.email ?? '';
      }
      if (!email) {
        setPullError("Couldn't read your email from session. Try refreshing.");
        return;
      }
      const res = await fetch(
        `${apiBaseUrl()}/api/estimates/${estimateId}/excel/pull`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      const body = (await res.json()) as { error?: string; warnings?: string[] };
      if (!res.ok) {
        setPullError(body.error ?? `Pull failed (${res.status})`);
        return;
      }
      setPullResult(body);
      // Refresh the page after a successful pull so the user sees the new data.
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setPullError((err as Error).message);
    } finally {
      setPullBusy(false);
    }
  }


  async function saveToOneDrive() {
    // Need the user's email — fetch from /api/me which exists in the app.
    setBusy(true);
    setError(null);
    setSavedTo(null);
    try {
      const meRes = await fetch(`${apiBaseUrl()}/api/me`, { cache: 'no-store' });
      let email = '';
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string };
        email = me.email ?? '';
      }
      if (!email) {
        setError("Couldn't read your email from session. Try refreshing.");
        return;
      }
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
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { webUrl: string | null; path: string };
      setSavedTo(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <a
        href={`${apiBaseUrl()}/api/estimates/${estimateId}/excel.xlsx`}
        className="inline-flex items-center gap-1 rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100"
      >
        ↓ Download Excel
      </a>
      <button
        type="button"
        onClick={() => void saveToOneDrive()}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
      >
        {busy ? 'Saving…' : '📁 Save to OneDrive'}
      </button>
      <button
        type="button"
        onClick={() => void pullFromOneDrive()}
        disabled={pullBusy}
        className="inline-flex items-center gap-1 rounded-md border border-green-600 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:opacity-50"
      >
        {pullBusy ? 'Pulling…' : '↻ Pull latest from Excel'}
      </button>
      {savedTo ? (
        savedTo.webUrl ? (
          <a
            href={savedTo.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 underline"
          >
            ✓ Saved · open in OneDrive
          </a>
        ) : (
          <span className="text-xs text-green-700">✓ Saved to {savedTo.path}</span>
        )
      ) : null}
      {error ? (
        <span className="text-xs text-red-700">{error}</span>
      ) : null}
      {pullError ? (
        <span className="text-xs text-red-700">Pull: {pullError}</span>
      ) : null}
      {pullResult ? (
        <span className="text-xs text-green-700">
          ✓ Pulled from Excel — page refreshing…
        </span>
      ) : null}
    </div>
  );
}

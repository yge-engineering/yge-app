'use client';

// One-tap "finalize this inspection" for SWPPP.
//
// Plain English: while you're walking the site you save the inspection as
// a draft. When you sign it off back at the office, you click Finalize —
// that stamps finalizedOn server-side and locks the inspection into the
// audit binder. Re-open if you need to amend (rare; the state inspector
// has every right to ask why).

import { useRouter } from 'next/navigation';
import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function SwpppFinalizeBar({
  id,
  initialFinalizedOn,
}: {
  id: string;
  initialFinalizedOn?: string;
}) {
  const router = useRouter();
  const [finalizedOn, setFinalizedOn] = useState<string | undefined>(initialFinalizedOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(value: string | null): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/swppp-inspections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizedOn: value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      setFinalizedOn(value ?? undefined);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Report status</span>
        {finalizedOn ? (
          <>
            <span className="rounded bg-green-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
              Finalized
            </span>
            <span className="text-[11px] text-gray-500">on {finalizedOn}</span>
          </>
        ) : (
          <span className="rounded bg-gray-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-700">
            Draft
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!finalizedOn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch(new Date().toISOString().slice(0, 10))}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Finalize report
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm("Re-open this finalized report? It's better to add a corrective-action follow-up inspection.")) return;
              void patch(null);
            }}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Re-open report
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

'use client';

// One-tap status transitions for a certified payroll report (CPR).
//
// DRAFT            → SUBMITTED       (filed to DIR — stamps submittedAt)
// SUBMITTED        → ACCEPTED        (DIR accepted; clean filing)
// SUBMITTED        → AMENDED         (filed a correction)
// SUBMITTED        → NON_PERFORMANCE (the standard "no work this week" filing)
// any → DRAFT      (Reopen)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CprStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<CprStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-green-100 text-green-700',
  AMENDED: 'bg-yge-blue-100 text-yge-blue-800',
  NON_PERFORMANCE: 'bg-gray-100 text-gray-600',
};

export function CprStatusBar({
  id,
  initialStatus,
  submittedAt,
}: {
  id: string;
  initialStatus: CprStatus;
  submittedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<CprStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: CprStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SUBMITTED' && !submittedAt) patch.submittedAt = new Date().toISOString();
      const res = await fetch(`${apiBaseUrl()}/api/certified-payrolls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Transition failed (${res.status}).`);
        return;
      }
      setStatus(next);
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
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status.replace(/_/g, ' ')}
        </span>
        {submittedAt && <span className="text-[11px] text-gray-500">submitted {submittedAt.slice(0, 16).replace('T', ' ')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('SUBMITTED')}
              className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
              Submit to DIR
            </button>
            <button type="button" disabled={busy} onClick={() => transition('NON_PERFORMANCE')}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              File 'no work performed'
            </button>
          </>
        )}
        {status === 'SUBMITTED' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('ACCEPTED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              DIR accepted
            </button>
            <button type="button" disabled={busy} onClick={() => transition('AMENDED')}
              className="rounded border border-yge-blue-300 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
              Filed amendment
            </button>
          </>
        )}
        {status !== 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('DRAFT')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen as draft
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

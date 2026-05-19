'use client';

// One-tap status transitions for a submittal.
//
// DRAFT     → SUBMITTED   (Submit, stamps submittedAt today)
// SUBMITTED → APPROVED                    (Approved — stamps returnedAt)
// SUBMITTED → APPROVED_AS_NOTED           (Approved as noted)
// SUBMITTED → REVISE_RESUBMIT             (Revise + resubmit)
// SUBMITTED → REJECTED                    (Rejected)
// DRAFT/SUBMITTED → WITHDRAWN             (We pulled it back)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SubmittalStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<SubmittalStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-700',
  APPROVED_AS_NOTED: 'bg-green-50 text-green-700',
  REVISE_RESUBMIT: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

const RETURN_STATUSES = new Set<SubmittalStatus>([
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REVISE_RESUBMIT',
  'REJECTED',
]);

export function SubmittalStatusBar({
  id,
  initialStatus,
  submittedAt,
  returnedAt,
}: {
  id: string;
  initialStatus: SubmittalStatus;
  submittedAt?: string;
  returnedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SubmittalStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: SubmittalStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SUBMITTED' && !submittedAt) patch.submittedAt = today;
      if (RETURN_STATUSES.has(next) && !returnedAt) patch.returnedAt = today;
      const res = await fetch(`${apiBaseUrl()}/api/submittals/${id}`, {
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
        {submittedAt && <span className="text-[11px] text-gray-500">submitted {submittedAt}</span>}
        {returnedAt && <span className="text-[11px] text-gray-500">returned {returnedAt}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('SUBMITTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Submit
          </button>
        )}
        {status === 'SUBMITTED' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Mark approved
            </button>
            <button type="button" disabled={busy} onClick={() => transition('APPROVED_AS_NOTED')}
              className="rounded border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">
              Approved as noted
            </button>
            <button type="button" disabled={busy} onClick={() => transition('REVISE_RESUBMIT')}
              className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              Revise + resubmit
            </button>
            <button type="button" disabled={busy} onClick={() => transition('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Reject
            </button>
          </>
        )}
        {(status === 'DRAFT' || status === 'SUBMITTED') && (
          <button type="button" disabled={busy} onClick={() => transition('WITHDRAWN')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

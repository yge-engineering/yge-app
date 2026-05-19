'use client';

// One-tap status transitions for a PCO (potential change order).
//
// DRAFT                 → SUBMITTED              (Submit, stamps submittedOn)
// SUBMITTED             → UNDER_REVIEW           (agency asked questions)
// SUBMITTED/REVIEW      → APPROVED_PENDING_CO    (verbal yes, CO not executed yet)
// SUBMITTED/REVIEW      → REJECTED               (red)
// APPROVED_PENDING_CO   → CONVERTED_TO_CO        (executed CO replaces this PCO)
// DRAFT/SUBM/REVIEW     → WITHDRAWN              (we pulled it back)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PcoStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<PcoStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED_PENDING_CO: 'bg-yge-blue-100 text-yge-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
  CONVERTED_TO_CO: 'bg-green-100 text-green-700',
};

export function PcoStatusBar({
  id,
  initialStatus,
  submittedOn,
  lastResponseOn,
}: {
  id: string;
  initialStatus: PcoStatus;
  submittedOn?: string;
  lastResponseOn?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PcoStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: PcoStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SUBMITTED' && !submittedOn) patch.submittedOn = today;
      if (['UNDER_REVIEW', 'APPROVED_PENDING_CO', 'REJECTED'].includes(next)) {
        patch.lastResponseOn = today;
      }
      const res = await fetch(`${apiBaseUrl()}/api/pcos/${id}`, {
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
        {submittedOn && <span className="text-[11px] text-gray-500">submitted {submittedOn}</span>}
        {lastResponseOn && <span className="text-[11px] text-gray-500">last response {lastResponseOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('SUBMITTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Submit to agency
          </button>
        )}
        {status === 'SUBMITTED' && (
          <button type="button" disabled={busy} onClick={() => transition('UNDER_REVIEW')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Agency reviewing
          </button>
        )}
        {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('APPROVED_PENDING_CO')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Approved (CO pending)
            </button>
            <button type="button" disabled={busy} onClick={() => transition('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Rejected
            </button>
          </>
        )}
        {status === 'APPROVED_PENDING_CO' && (
          <button type="button" disabled={busy} onClick={() => transition('CONVERTED_TO_CO')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            CO executed (close PCO)
          </button>
        )}
        {(status === 'DRAFT' || status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
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

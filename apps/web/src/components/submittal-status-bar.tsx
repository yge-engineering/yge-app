'use client';

// DRAFT → SUBMITTED → APPROVED / APPROVED_AS_NOTED / REVISE_RESUBMIT / REJECTED;
// DRAFT/SUBMITTED → WITHDRAWN.

import type { SubmittalStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

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
  const { status, busy, error, transition } = useStatusTransition<SubmittalStatus>({
    route: 'submittals',
    id,
    initial: initialStatus,
  });

  async function go(next: SubmittalStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SUBMITTED' && !submittedAt) extras.submittedAt = todayDate();
    if (RETURN_STATUSES.has(next) && !returnedAt) extras.returnedAt = todayDate();
    await transition(next, extras);
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
          <button type="button" disabled={busy} onClick={() => void go('SUBMITTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Submit
          </button>
        )}
        {status === 'SUBMITTED' && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Mark approved
            </button>
            <button type="button" disabled={busy} onClick={() => void go('APPROVED_AS_NOTED')}
              className="rounded border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">
              Approved as noted
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REVISE_RESUBMIT')}
              className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              Revise + resubmit
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Reject
            </button>
          </>
        )}
        {(status === 'DRAFT' || status === 'SUBMITTED') && (
          <button type="button" disabled={busy} onClick={() => void go('WITHDRAWN')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

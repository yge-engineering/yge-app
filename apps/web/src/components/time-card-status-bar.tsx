'use client';

// DRAFT → SUBMITTED → APPROVED → POSTED; with REJECTED off-ramp.

import type { TimeCardStatus } from '@yge/shared';
import { nowIso, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<TimeCardStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-yge-blue-100 text-yge-blue-800',
  POSTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-800',
};

export function TimeCardStatusBar({
  id,
  initialStatus,
  submittedAt,
  approvedAt,
}: {
  id: string;
  initialStatus: TimeCardStatus;
  submittedAt?: string;
  approvedAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<TimeCardStatus>({
    route: 'time-cards',
    id,
    initial: initialStatus,
  });

  async function go(next: TimeCardStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SUBMITTED' && !submittedAt) extras.submittedAt = nowIso();
    if (next === 'APPROVED' && !approvedAt) extras.approvedAt = nowIso();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {submittedAt && <span className="text-[11px] text-gray-500">submitted {submittedAt.slice(0, 16).replace('T', ' ')}</span>}
        {approvedAt && <span className="text-[11px] text-gray-500">approved {approvedAt.slice(0, 16).replace('T', ' ')}</span>}
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
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Reject (back to employee)
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => void go('POSTED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark posted to payroll
          </button>
        )}
        {status !== 'DRAFT' && status !== 'POSTED' && (
          <button type="button" disabled={busy} onClick={() => void go('DRAFT')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen as draft
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

'use client';

// PROPOSED → AGENCY_REVIEW → APPROVED → EXECUTED; with REJECTED + WITHDRAWN.

import type { ChangeOrderStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<ChangeOrderStatus, string> = {
  PROPOSED: 'bg-gray-100 text-gray-700',
  AGENCY_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-yge-blue-100 text-yge-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXECUTED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

export function ChangeOrderStatusBar({
  id,
  initialStatus,
  proposedAt,
  approvedAt,
  executedAt,
}: {
  id: string;
  initialStatus: ChangeOrderStatus;
  proposedAt?: string;
  approvedAt?: string;
  executedAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<ChangeOrderStatus>({
    route: 'change-orders',
    id,
    initial: initialStatus,
  });

  async function go(next: ChangeOrderStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'AGENCY_REVIEW' && !proposedAt) extras.proposedAt = todayDate();
    if (next === 'APPROVED' && !approvedAt) extras.approvedAt = todayDate();
    if (next === 'EXECUTED' && !executedAt) extras.executedAt = todayDate();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status.replace(/_/g, ' ')}
        </span>
        {proposedAt && <span className="text-[11px] text-gray-500">proposed {proposedAt}</span>}
        {approvedAt && <span className="text-[11px] text-gray-500">approved {approvedAt}</span>}
        {executedAt && <span className="text-[11px] text-gray-500">executed {executedAt}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'PROPOSED' && (
          <button type="button" disabled={busy} onClick={() => void go('AGENCY_REVIEW')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Send to agency
          </button>
        )}
        {status === 'AGENCY_REVIEW' && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Agency approved
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Agency rejected
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => void go('EXECUTED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark executed
          </button>
        )}
        {(status === 'PROPOSED' || status === 'AGENCY_REVIEW') && (
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

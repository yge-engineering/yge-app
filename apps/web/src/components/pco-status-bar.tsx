'use client';

// DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED_PENDING_CO → CONVERTED_TO_CO;
// with REJECTED / WITHDRAWN off-ramps.

import type { PcoStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<PcoStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED_PENDING_CO: 'bg-yge-blue-100 text-yge-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
  CONVERTED_TO_CO: 'bg-green-100 text-green-700',
};

const RESPONSE_STATUSES = new Set<PcoStatus>([
  'UNDER_REVIEW',
  'APPROVED_PENDING_CO',
  'REJECTED',
]);

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
  const { status, busy, error, transition } = useStatusTransition<PcoStatus>({
    route: 'pcos',
    id,
    initial: initialStatus,
  });

  async function go(next: PcoStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    const today = todayDate();
    if (next === 'SUBMITTED' && !submittedOn) extras.submittedOn = today;
    if (RESPONSE_STATUSES.has(next)) extras.lastResponseOn = today;
    await transition(next, extras);
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
          <button type="button" disabled={busy} onClick={() => void go('SUBMITTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Submit to agency
          </button>
        )}
        {status === 'SUBMITTED' && (
          <button type="button" disabled={busy} onClick={() => void go('UNDER_REVIEW')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Agency reviewing
          </button>
        )}
        {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('APPROVED_PENDING_CO')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Approved (CO pending)
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Rejected
            </button>
          </>
        )}
        {status === 'APPROVED_PENDING_CO' && (
          <button type="button" disabled={busy} onClick={() => void go('CONVERTED_TO_CO')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            CO executed (close PCO)
          </button>
        )}
        {(status === 'DRAFT' || status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
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

'use client';

// DRAFT → SUBMITTED → ACCEPTED / AMENDED; DRAFT → NON_PERFORMANCE.

import type { CprStatus } from '@yge/shared';
import { nowIso, useStatusTransition } from '../lib/use-status-transition';

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
  const { status, busy, error, transition } = useStatusTransition<CprStatus>({
    route: 'certified-payrolls',
    id,
    initial: initialStatus,
  });

  async function go(next: CprStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SUBMITTED' && !submittedAt) extras.submittedAt = nowIso();
    await transition(next, extras);
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
            <button type="button" disabled={busy} onClick={() => void go('SUBMITTED')}
              className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
              Submit to DIR
            </button>
            <button type="button" disabled={busy} onClick={() => void go('NON_PERFORMANCE')}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              File 'no work performed'
            </button>
          </>
        )}
        {status === 'SUBMITTED' && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('ACCEPTED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              DIR accepted
            </button>
            <button type="button" disabled={busy} onClick={() => void go('AMENDED')}
              className="rounded border border-yge-blue-300 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
              Filed amendment
            </button>
          </>
        )}
        {status !== 'DRAFT' && (
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

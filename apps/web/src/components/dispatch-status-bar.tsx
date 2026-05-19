'use client';

// One-tap status transitions for a dispatch.
//
// DRAFT  → POSTED      (Post to foremen, stamps postedAt)
// POSTED → COMPLETED   (Mark complete, stamps completedAt)
// active → CANCELLED   (Cancel day, red destructive)

import type { DispatchStatus } from '@yge/shared';
import { nowIso, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<DispatchStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  POSTED: 'bg-yge-blue-100 text-yge-blue-800',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function DispatchStatusBar({
  id,
  initialStatus,
  postedAt,
  completedAt,
}: {
  id: string;
  initialStatus: DispatchStatus;
  postedAt?: string;
  completedAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<DispatchStatus>({
    route: 'dispatches',
    id,
    initial: initialStatus,
  });

  async function go(next: DispatchStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'POSTED' && !postedAt) extras.postedAt = nowIso();
    if (next === 'COMPLETED' && !completedAt) extras.completedAt = nowIso();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {postedAt && status !== 'DRAFT' && (
          <span className="text-[11px] text-gray-500">posted {postedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
        {completedAt && status === 'COMPLETED' && (
          <span className="text-[11px] text-gray-500">completed {completedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('POSTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Post to foremen
          </button>
        )}
        {status === 'POSTED' && (
          <button type="button" disabled={busy} onClick={() => void go('COMPLETED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark complete
          </button>
        )}
        {(status === 'DRAFT' || status === 'POSTED') && (
          <button type="button" disabled={busy} onClick={() => void go('CANCELLED')}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Cancel day
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

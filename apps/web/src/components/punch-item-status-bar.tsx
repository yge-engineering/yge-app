'use client';

// One-tap status transitions for a punch item.
// OPEN → IN_PROGRESS → CLOSED (with optional initials field);
// OPEN → DISPUTED / WAIVED; non-OPEN → OPEN (Reopen).

import { useState } from 'react';
import type { PunchItemStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<PunchItemStatus, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-yge-blue-100 text-yge-blue-800',
  WAIVED: 'bg-gray-100 text-gray-600',
};

export function PunchItemStatusBar({
  id,
  initialStatus,
  closedOn,
}: {
  id: string;
  initialStatus: PunchItemStatus;
  closedOn?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<PunchItemStatus>({
    route: 'punch-items',
    id,
    initial: initialStatus,
  });
  const [initials, setInitials] = useState('');

  async function go(next: PunchItemStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'CLOSED') {
      if (!closedOn) extras.closedOn = todayDate();
      if (initials.trim()) extras.closedByInitials = initials.trim().toUpperCase();
    }
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status.replace('_', ' ')}
        </span>
        {closedOn && status === 'CLOSED' && (
          <span className="text-[11px] text-gray-500">closed {closedOn}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'OPEN' && (
          <button type="button" disabled={busy} onClick={() => void go('IN_PROGRESS')}
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            Start work
          </button>
        )}
        {status !== 'CLOSED' && (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="initials" maxLength={5}
              value={initials} onChange={(e) => setInitials(e.target.value)}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs font-mono uppercase" />
            <button type="button" disabled={busy} onClick={() => void go('CLOSED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Close
            </button>
          </div>
        )}
        {status === 'OPEN' && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('DISPUTED')}
              className="rounded border border-yge-blue-300 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
              Dispute
            </button>
            <button type="button" disabled={busy} onClick={() => void go('WAIVED')}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Waive
            </button>
          </>
        )}
        {status !== 'OPEN' && status !== 'CLOSED' && (
          <button type="button" disabled={busy} onClick={() => void go('OPEN')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

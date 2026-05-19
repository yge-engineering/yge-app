'use client';

// DRAFT → HELD → SUBMITTED.

import type { ToolboxTalkStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<ToolboxTalkStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  HELD: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-green-100 text-green-700',
};

export function ToolboxTalkStatusBar({
  id,
  initialStatus,
  submittedOn,
}: {
  id: string;
  initialStatus: ToolboxTalkStatus;
  submittedOn?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<ToolboxTalkStatus>({
    route: 'toolbox-talks',
    id,
    initial: initialStatus,
  });

  async function go(next: ToolboxTalkStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SUBMITTED' && !submittedOn) extras.submittedOn = todayDate();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {submittedOn && <span className="text-[11px] text-gray-500">submitted {submittedOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('HELD')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark held
          </button>
        )}
        {status === 'HELD' && (
          <button type="button" disabled={busy} onClick={() => void go('SUBMITTED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            File to safety binder
          </button>
        )}
        {status !== 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('DRAFT')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

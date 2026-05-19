'use client';

// One-tap status transitions for an OSHA 300/301 incident.
// OPEN ↔ CLOSED.

import type { IncidentStatus } from '@yge/shared';
import { useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-700',
};

export function IncidentStatusBar({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: IncidentStatus;
}) {
  const { status, busy, error, transition } = useStatusTransition<IncidentStatus>({
    route: 'incidents',
    id,
    initial: initialStatus,
  });

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Case status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'OPEN' ? (
          <button type="button" disabled={busy} onClick={() => void transition('CLOSED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Close case
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void transition('OPEN')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Reopen case
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

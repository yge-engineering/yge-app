'use client';

// DRAFT → SENT → ANSWERED → CLOSED; DRAFT/SENT → WITHDRAWN.

import type { RfiStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<RfiStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-amber-100 text-amber-800',
  ANSWERED: 'bg-yge-blue-100 text-yge-blue-800',
  CLOSED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-red-100 text-red-700',
};

export function RfiStatusBar({
  id,
  initialStatus,
  sentAt,
  answeredAt,
}: {
  id: string;
  initialStatus: RfiStatus;
  sentAt?: string;
  answeredAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<RfiStatus>({
    route: 'rfis',
    id,
    initial: initialStatus,
  });

  async function go(next: RfiStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SENT' && !sentAt) extras.sentAt = todayDate();
    if (next === 'ANSWERED' && !answeredAt) extras.answeredAt = todayDate();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {sentAt && <span className="text-[11px] text-gray-500">sent {sentAt}</span>}
        {answeredAt && <span className="text-[11px] text-gray-500">answered {answeredAt}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('SENT')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Send to engineer
          </button>
        )}
        {status === 'SENT' && (
          <button type="button" disabled={busy} onClick={() => void go('ANSWERED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark answered
          </button>
        )}
        {status === 'ANSWERED' && (
          <button type="button" disabled={busy} onClick={() => void go('CLOSED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Close RFI
          </button>
        )}
        {(status === 'DRAFT' || status === 'SENT') && (
          <button type="button" disabled={busy} onClick={() => void go('WITHDRAWN')}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

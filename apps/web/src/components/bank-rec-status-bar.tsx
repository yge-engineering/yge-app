'use client';

// DRAFT → RECONCILED → DRAFT (reopen on late match); any → VOIDED off-ramp.

import type { BankRecStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<BankRecStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  RECONCILED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-800',
};

export function BankRecStatusBar({
  id,
  initialStatus,
  reconciledOn,
}: {
  id: string;
  initialStatus: BankRecStatus;
  reconciledOn?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<BankRecStatus>({
    route: 'bank-recs',
    id,
    initial: initialStatus,
  });

  async function go(next: BankRecStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'RECONCILED' && !reconciledOn) extras.reconciledOn = todayDate();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {reconciledOn && <span className="text-[11px] text-gray-500">reconciled {reconciledOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('RECONCILED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark reconciled
          </button>
        )}
        {status === 'RECONCILED' && (
          <button type="button" disabled={busy} onClick={() => void go('DRAFT')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Reopen (late match)
          </button>
        )}
        {status !== 'VOIDED' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Void this reconciliation? Use only if the bank statement itself was wrong.")) return;
              void go('VOIDED');
            }}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Void
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

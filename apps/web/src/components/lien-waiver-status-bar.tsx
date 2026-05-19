'use client';

// One-tap status transitions for a lien waiver.
// DRAFT → SIGNED → DELIVERED; with VOIDED off-ramp.

import type { LienWaiverStatus } from '@yge/shared';
import { todayDate, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<LienWaiverStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SIGNED: 'bg-amber-100 text-amber-800',
  DELIVERED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-800',
};

export function LienWaiverStatusBar({
  id,
  initialStatus,
  signedOn,
  deliveredOn,
}: {
  id: string;
  initialStatus: LienWaiverStatus;
  signedOn?: string;
  deliveredOn?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<LienWaiverStatus>({
    route: 'lien-waivers',
    id,
    initial: initialStatus,
  });

  async function go(next: LienWaiverStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SIGNED' && !signedOn) extras.signedOn = todayDate();
    if (next === 'DELIVERED' && !deliveredOn) extras.deliveredOn = todayDate();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {signedOn && <span className="text-[11px] text-gray-500">signed {signedOn}</span>}
        {deliveredOn && <span className="text-[11px] text-gray-500">delivered {deliveredOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('SIGNED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark signed
          </button>
        )}
        {status === 'SIGNED' && (
          <button type="button" disabled={busy} onClick={() => void go('DELIVERED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark delivered
          </button>
        )}
        {status !== 'VOIDED' && status !== 'DELIVERED' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Void this waiver? Use only for typos / wrong amount before delivery.")) return;
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

'use client';

// DRAFT → PENDING → APPROVED → PAID; with REJECTED off-ramp.

import type { ApInvoiceStatus } from '@yge/shared';
import { nowIso, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<ApInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-yge-blue-100 text-yge-blue-800',
  PAID: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-800',
};

export function ApInvoiceStatusBar({
  id,
  initialStatus,
  approvedAt,
  paidAt,
}: {
  id: string;
  initialStatus: ApInvoiceStatus;
  approvedAt?: string;
  paidAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<ApInvoiceStatus>({
    route: 'ap-invoices',
    id,
    initial: initialStatus,
  });

  async function go(next: ApInvoiceStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'APPROVED' && !approvedAt) extras.approvedAt = nowIso();
    if (next === 'PAID' && !paidAt) extras.paidAt = nowIso();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {approvedAt && <span className="text-[11px] text-gray-500">approved {approvedAt.slice(0, 16).replace('T', ' ')}</span>}
        {paidAt && <span className="text-[11px] text-gray-500">paid {paidAt.slice(0, 16).replace('T', ' ')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('PENDING')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Route for approval
          </button>
        )}
        {status === 'PENDING' && (
          <>
            <button type="button" disabled={busy} onClick={() => void go('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => void go('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Reject (dispute)
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => void go('PAID')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark paid
          </button>
        )}
        {status !== 'DRAFT' && status !== 'PAID' && (
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

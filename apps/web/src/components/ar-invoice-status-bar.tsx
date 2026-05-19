'use client';

// DRAFT → SENT → PARTIALLY_PAID / PAID; with DISPUTED + WRITTEN_OFF off-ramps.

import type { ArInvoiceStatus } from '@yge/shared';
import { nowIso, useStatusTransition } from '../lib/use-status-transition';

const STATUS_TONE: Record<ArInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-amber-100 text-amber-800',
  PARTIALLY_PAID: 'bg-yge-blue-100 text-yge-blue-800',
  PAID: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-red-100 text-red-800',
  WRITTEN_OFF: 'bg-gray-100 text-gray-600',
};

export function ArInvoiceStatusBar({
  id,
  initialStatus,
  sentAt,
}: {
  id: string;
  initialStatus: ArInvoiceStatus;
  sentAt?: string;
}) {
  const { status, busy, error, transition } = useStatusTransition<ArInvoiceStatus>({
    route: 'ar-invoices',
    id,
    initial: initialStatus,
  });

  async function go(next: ArInvoiceStatus): Promise<void> {
    const extras: Record<string, unknown> = {};
    if (next === 'SENT' && !sentAt) extras.sentAt = nowIso();
    await transition(next, extras);
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status.replace('_', ' ')}
        </span>
        {sentAt && <span className="text-[11px] text-gray-500">sent {sentAt.slice(0, 16).replace('T', ' ')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => void go('SENT')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Send to owner
          </button>
        )}
        {(status === 'SENT' || status === 'PARTIALLY_PAID') && (
          <button type="button" disabled={busy} onClick={() => void go('PAID')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark paid in full
          </button>
        )}
        {status === 'SENT' && (
          <button type="button" disabled={busy} onClick={() => void go('PARTIALLY_PAID')}
            className="rounded border border-yge-blue-300 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
            First payment received
          </button>
        )}
        {(status === 'SENT' || status === 'PARTIALLY_PAID') && (
          <button type="button" disabled={busy} onClick={() => void go('DISPUTED')}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Dispute
          </button>
        )}
        {status !== 'WRITTEN_OFF' && status !== 'PAID' && status !== 'DRAFT' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Write this invoice off as uncollectible? It moves into the bad-debt bucket on the trial balance.")) return;
              void go('WRITTEN_OFF');
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Write off
          </button>
        )}
        {status !== 'DRAFT' && status !== 'PAID' && status !== 'WRITTEN_OFF' && (
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

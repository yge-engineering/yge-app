'use client';

// One-tap status transitions for an AP invoice.
//
// DRAFT     → PENDING    (route for approval)
// PENDING   → APPROVED   (Brook / Ryan sign off — stamps approvedAt)
// APPROVED  → PAID       (check cut / ACH sent — stamps paidAt)
// PENDING   → REJECTED   (dispute the bill back to the vendor)
// any non-paid → DRAFT   (Reopen)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApInvoiceStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

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
  const router = useRouter();
  const [status, setStatus] = useState<ApInvoiceStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: ApInvoiceStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: next };
      if (next === 'APPROVED' && !approvedAt) patch.approvedAt = now;
      if (next === 'PAID' && !paidAt) patch.paidAt = now;
      const res = await fetch(`${apiBaseUrl()}/api/ap-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Transition failed (${res.status}).`);
        return;
      }
      setStatus(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
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
          <button type="button" disabled={busy} onClick={() => transition('PENDING')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Route for approval
          </button>
        )}
        {status === 'PENDING' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => transition('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Reject (dispute)
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => transition('PAID')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark paid
          </button>
        )}
        {status !== 'DRAFT' && status !== 'PAID' && (
          <button type="button" disabled={busy} onClick={() => transition('DRAFT')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen as draft
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

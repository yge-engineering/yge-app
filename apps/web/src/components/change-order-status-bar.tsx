'use client';

// One-tap status transitions for a change order (CO).
//
// PROPOSED       → AGENCY_REVIEW   (Send to agency)
// AGENCY_REVIEW  → APPROVED        (Agency approved — stamps approvedAt)
// AGENCY_REVIEW  → REJECTED        (Agency said no)
// APPROVED       → EXECUTED        (Owner + contractor signed — stamps executedAt)
// PROPOSED/REVIEW → WITHDRAWN      (We pulled it back)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ChangeOrderStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<ChangeOrderStatus, string> = {
  PROPOSED: 'bg-gray-100 text-gray-700',
  AGENCY_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-yge-blue-100 text-yge-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXECUTED: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

export function ChangeOrderStatusBar({
  id,
  initialStatus,
  proposedAt,
  approvedAt,
  executedAt,
}: {
  id: string;
  initialStatus: ChangeOrderStatus;
  proposedAt?: string;
  approvedAt?: string;
  executedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ChangeOrderStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: ChangeOrderStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'AGENCY_REVIEW' && !proposedAt) patch.proposedAt = today;
      if (next === 'APPROVED' && !approvedAt) patch.approvedAt = today;
      if (next === 'EXECUTED' && !executedAt) patch.executedAt = today;
      const res = await fetch(`${apiBaseUrl()}/api/change-orders/${id}`, {
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
          {status.replace(/_/g, ' ')}
        </span>
        {proposedAt && <span className="text-[11px] text-gray-500">proposed {proposedAt}</span>}
        {approvedAt && <span className="text-[11px] text-gray-500">approved {approvedAt}</span>}
        {executedAt && <span className="text-[11px] text-gray-500">executed {executedAt}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'PROPOSED' && (
          <button type="button" disabled={busy} onClick={() => transition('AGENCY_REVIEW')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Send to agency
          </button>
        )}
        {status === 'AGENCY_REVIEW' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('APPROVED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Agency approved
            </button>
            <button type="button" disabled={busy} onClick={() => transition('REJECTED')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Agency rejected
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button type="button" disabled={busy} onClick={() => transition('EXECUTED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark executed
          </button>
        )}
        {(status === 'PROPOSED' || status === 'AGENCY_REVIEW') && (
          <button type="button" disabled={busy} onClick={() => transition('WITHDRAWN')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

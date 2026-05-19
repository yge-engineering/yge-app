'use client';

// Status transition buttons for a single punch item.
// Open → In progress → Closed (with optional initials), or → Disputed / Waived.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PunchItemStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<PunchItemStatus, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-yge-blue-100 text-yge-blue-800',
  WAIVED: 'bg-gray-100 text-gray-600',
};

export function PunchItemStatusControls({
  id,
  initialStatus,
  closedOn,
}: {
  id: string;
  initialStatus: PunchItemStatus;
  closedOn?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PunchItemStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initials, setInitials] = useState('');

  async function transition(next: PunchItemStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { status: next };
      if (next === 'CLOSED') {
        if (!closedOn) patch.closedOn = new Date().toISOString().slice(0, 10);
        if (initials.trim()) patch.closedByInitials = initials.trim().toUpperCase();
      }
      const res = await fetch(`${apiBaseUrl()}/api/punch-items/${id}`, {
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
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status.replace('_', ' ')}
        </span>
        {closedOn && status === 'CLOSED' && (
          <span className="text-[11px] text-gray-500">closed {closedOn}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status !== 'OPEN' && status !== 'CLOSED' && (
          <button type="button" disabled={busy} onClick={() => transition('OPEN')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen
          </button>
        )}
        {status === 'OPEN' && (
          <button type="button" disabled={busy} onClick={() => transition('IN_PROGRESS')}
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            Start work
          </button>
        )}
        {status !== 'CLOSED' && (
          <div className="flex items-center gap-2">
            <input
              type="text" placeholder="initials" maxLength={5}
              value={initials} onChange={(e) => setInitials(e.target.value)}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs font-mono uppercase"
            />
            <button type="button" disabled={busy} onClick={() => transition('CLOSED')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Close
            </button>
          </div>
        )}
        {status === 'OPEN' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('DISPUTED')}
              className="rounded border border-yge-blue-300 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
              Dispute
            </button>
            <button type="button" disabled={busy} onClick={() => transition('WAIVED')}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Waive
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

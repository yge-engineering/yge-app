'use client';

// One-tap status transitions for an RFI.
//
// DRAFT     → SENT       (Send, stamps sentAt today)
// SENT      → ANSWERED   (Mark answered, stamps answeredAt today;
//                         the answer text itself goes in the editor)
// ANSWERED  → CLOSED     (Close — the engineer's response is on
//                         the record; no further action needed)
// DRAFT/SENT → WITHDRAWN (Withdraw — we asked the wrong question)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RfiStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

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
  const router = useRouter();
  const [status, setStatus] = useState<RfiStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: RfiStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SENT' && !sentAt) patch.sentAt = today;
      if (next === 'ANSWERED' && !answeredAt) patch.answeredAt = today;
      const res = await fetch(`${apiBaseUrl()}/api/rfis/${id}`, {
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
        {sentAt && <span className="text-[11px] text-gray-500">sent {sentAt}</span>}
        {answeredAt && <span className="text-[11px] text-gray-500">answered {answeredAt}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('SENT')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Send to engineer
          </button>
        )}
        {status === 'SENT' && (
          <button type="button" disabled={busy} onClick={() => transition('ANSWERED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark answered
          </button>
        )}
        {status === 'ANSWERED' && (
          <button type="button" disabled={busy} onClick={() => transition('CLOSED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Close RFI
          </button>
        )}
        {(status === 'DRAFT' || status === 'SENT') && (
          <button type="button" disabled={busy} onClick={() => transition('WITHDRAWN')}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Withdraw
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

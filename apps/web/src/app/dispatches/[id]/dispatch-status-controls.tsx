'use client';

// Status transition buttons for a single dispatch.
// DRAFT  → POSTED   (clicking Post)
// POSTED → COMPLETED (clicking Mark complete)
// any → CANCELLED   (clicking Cancel)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DispatchStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<DispatchStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  POSTED: 'bg-yge-blue-100 text-yge-blue-800',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function DispatchStatusControls({
  id,
  initialStatus,
  postedAt,
  completedAt,
}: {
  id: string;
  initialStatus: DispatchStatus;
  postedAt?: string;
  completedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DispatchStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: DispatchStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: { status: DispatchStatus; postedAt?: string; completedAt?: string } = {
        status: next,
      };
      if (next === 'POSTED' && !postedAt) patch.postedAt = new Date().toISOString();
      if (next === 'COMPLETED' && !completedAt) patch.completedAt = new Date().toISOString();

      const res = await fetch(`${apiBaseUrl()}/api/dispatches/${id}`, {
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
          {status}
        </span>
        {postedAt && status !== 'DRAFT' && (
          <span className="text-[11px] text-gray-500">posted {postedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
        {completedAt && status === 'COMPLETED' && (
          <span className="text-[11px] text-gray-500">completed {completedAt.slice(0, 16).replace('T', ' ')}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition('POSTED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            Post to foremen
          </button>
        )}
        {status === 'POSTED' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition('COMPLETED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark complete
          </button>
        )}
        {(status === 'DRAFT' || status === 'POSTED') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition('CANCELLED')}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel day
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}

'use client';

// One-tap status transitions for a toolbox talk.
//
// DRAFT → HELD       (Mark held — talk happened; heldOn is already set)
// HELD  → SUBMITTED  (file to safety binder / agency — stamps submittedOn)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ToolboxTalkStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<ToolboxTalkStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  HELD: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-green-100 text-green-700',
};

export function ToolboxTalkStatusBar({
  id,
  initialStatus,
  submittedOn,
}: {
  id: string;
  initialStatus: ToolboxTalkStatus;
  submittedOn?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ToolboxTalkStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: ToolboxTalkStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SUBMITTED' && !submittedOn) patch.submittedOn = today;
      const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks/${id}`, {
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
        {submittedOn && <span className="text-[11px] text-gray-500">submitted {submittedOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('HELD')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark held
          </button>
        )}
        {status === 'HELD' && (
          <button type="button" disabled={busy} onClick={() => transition('SUBMITTED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            File to safety binder
          </button>
        )}
        {status !== 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('DRAFT')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

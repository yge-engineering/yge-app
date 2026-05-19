'use client';

// One-tap status transitions for a bank reconciliation.
//
// DRAFT       → RECONCILED   (Mark reconciled — stamps reconciledOn)
// RECONCILED  → DRAFT        (Reopen — usually because a late match arrived)
// any         → VOIDED       (rare; statement was wrong)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BankRecStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

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
  const router = useRouter();
  const [status, setStatus] = useState<BankRecStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: BankRecStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'RECONCILED' && !reconciledOn) patch.reconciledOn = today;
      const res = await fetch(`${apiBaseUrl()}/api/bank-recs/${id}`, {
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
        {reconciledOn && <span className="text-[11px] text-gray-500">reconciled {reconciledOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('RECONCILED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark reconciled
          </button>
        )}
        {status === 'RECONCILED' && (
          <button type="button" disabled={busy} onClick={() => transition('DRAFT')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Reopen (late match)
          </button>
        )}
        {status !== 'VOIDED' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Void this reconciliation? Use only if the bank statement itself was wrong.")) return;
              void transition('VOIDED');
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

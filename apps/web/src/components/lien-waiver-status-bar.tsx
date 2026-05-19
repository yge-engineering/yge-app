'use client';

// One-tap status transitions for a lien waiver.
//
// DRAFT     → SIGNED      (notarized — stamps signedOn)
// SIGNED    → DELIVERED   (handed to owner — stamps deliveredOn)
// any → VOIDED            (rare; in case of typo / wrong amount)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LienWaiverStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

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
  const router = useRouter();
  const [status, setStatus] = useState<LienWaiverStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: LienWaiverStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status: next };
      if (next === 'SIGNED' && !signedOn) patch.signedOn = today;
      if (next === 'DELIVERED' && !deliveredOn) patch.deliveredOn = today;
      const res = await fetch(`${apiBaseUrl()}/api/lien-waivers/${id}`, {
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
        {signedOn && <span className="text-[11px] text-gray-500">signed {signedOn}</span>}
        {deliveredOn && <span className="text-[11px] text-gray-500">delivered {deliveredOn}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy} onClick={() => transition('SIGNED')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark signed
          </button>
        )}
        {status === 'SIGNED' && (
          <button type="button" disabled={busy} onClick={() => transition('DELIVERED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Mark delivered
          </button>
        )}
        {status !== 'VOIDED' && status !== 'DELIVERED' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Void this waiver? Use only for typos / wrong amount before delivery.")) return;
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

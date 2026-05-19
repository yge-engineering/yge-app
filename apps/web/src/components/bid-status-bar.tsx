'use client';

// One-tap bid-status transitions for an estimate.
//
// pursuing  → submitted   (bid sent — stamps bidSubmittedAt now)
// submitted → awarded     (YGE won — visible in bid analytics)
// submitted → lost        (someone else got it)
// awarded/lost → submitted (mis-marked; reopen for re-decision)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PricedEstimate } from '@yge/shared';

type BidStatus = NonNullable<PricedEstimate['bidStatus']>;

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<BidStatus, string> = {
  pursuing: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  awarded: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-800',
};

export function BidStatusBar({
  apiBaseUrl: apiBaseUrlProp,
  estimateId,
  initialStatus,
  bidSubmittedAt,
}: {
  apiBaseUrl?: string;
  estimateId: string;
  initialStatus: BidStatus;
  bidSubmittedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<BidStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = apiBaseUrlProp ?? apiBaseUrl();

  async function transition(next: BidStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { bidStatus: next };
      if (next === 'submitted' && !bidSubmittedAt) {
        patch.bidSubmittedAt = new Date().toISOString();
      }
      const res = await fetch(`${base}/api/priced-estimates/${estimateId}`, {
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
        <span className="text-xs uppercase tracking-wide text-gray-500">Bid status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
        {bidSubmittedAt && status !== 'pursuing' && (
          <span className="text-[11px] text-gray-500">
            submitted {bidSubmittedAt.slice(0, 16).replace('T', ' ')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'pursuing' && (
          <button type="button" disabled={busy} onClick={() => transition('submitted')}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Mark submitted
          </button>
        )}
        {status === 'submitted' && (
          <>
            <button type="button" disabled={busy} onClick={() => transition('awarded')}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              We won (awarded)
            </button>
            <button type="button" disabled={busy} onClick={() => transition('lost')}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Lost the bid
            </button>
          </>
        )}
        {(status === 'awarded' || status === 'lost') && (
          <button type="button" disabled={busy} onClick={() => transition('submitted')}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Reopen (mis-marked)
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

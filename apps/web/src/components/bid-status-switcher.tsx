'use client';

// Toolbar control that flips the bidStatus on a priced estimate.
// Renders the current status as a colored pill plus a small dropdown
// to pick a new value. PATCHes the priced-estimates API and refreshes
// the page so the rest of the UI reflects the new status.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type BidStatus = 'pursuing' | 'submitted' | 'awarded' | 'lost';

interface Props {
  apiBaseUrl: string;
  estimateId: string;
  current: BidStatus | undefined;
  submittedAt?: string | undefined;
}

const ORDER: ReadonlyArray<{
  value: BidStatus;
  label: string;
  tone: string;
}> = [
  {
    value: 'pursuing',
    label: 'Pursuing',
    tone: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  {
    value: 'submitted',
    label: 'Submitted',
    tone: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  {
    value: 'awarded',
    label: 'Awarded',
    tone: 'border-green-300 bg-green-50 text-green-800',
  },
  {
    value: 'lost',
    label: 'Lost',
    tone: 'border-gray-300 bg-gray-100 text-gray-600',
  },
];

function formatSubmitted(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ageDays = Math.max(0, Math.round((Date.now() - t) / (24 * 60 * 60 * 1000)));
  const dateStr = new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  if (ageDays === 0) return `Submitted ${dateStr} · today`;
  if (ageDays === 1) return `Submitted ${dateStr} · 1d ago`;
  return `Submitted ${dateStr} · ${ageDays}d ago`;
}

export function BidStatusSwitcher({
  apiBaseUrl,
  estimateId,
  current,
  submittedAt,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<BidStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = current ?? 'pursuing';

  async function update(next: BidStatus) {
    if (next === value) return;
    setBusy(next);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${encodeURIComponent(estimateId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidStatus: next }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">
        Status
      </span>
      {ORDER.map((opt) => {
        const active = opt.value === value;
        const isBusy = busy === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => void update(opt.value)}
            disabled={busy != null}
            className={`rounded-full border px-2 py-0.5 font-medium transition ${
              active
                ? `${opt.tone} ring-1 ring-offset-1`
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            } disabled:opacity-60`}
            title={`Mark as ${opt.label.toLowerCase()}`}
          >
            {isBusy ? '…' : opt.label}
          </button>
        );
      })}
      {(value === 'submitted' || value === 'awarded' || value === 'lost') &&
        formatSubmitted(submittedAt) && (
          <span className="text-[10px] text-gray-600">
            {formatSubmitted(submittedAt)}
          </span>
        )}
      {error && <span className="text-red-700">⚠ {error}</span>}
    </span>
  );
}

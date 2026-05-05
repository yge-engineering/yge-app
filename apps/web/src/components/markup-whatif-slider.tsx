'use client';

// MarkupWhatIfSlider — drag a markup percentage and see what the bid
// total would be without actually saving. Apply commits the change
// via PATCH /api/priced-estimates/:id, which the existing editor
// already triggers when oppPercent changes through other paths.
//
// Plain English: estimator wants to ask "what if I bid this at 18%
// instead of 20%? what's the bid total?" without losing their place
// or scrolling the editor. This sits next to the bid total tile and
// updates live.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  estimateId: string;
  apiBaseUrl: string;
  /** Current oppPercent, e.g. 0.20 for 20%. */
  currentOppPercent: number;
  /** Direct cost (everything but markup) in cents. */
  directCostCents: number;
}

function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function MarkupWhatIfSlider({
  estimateId,
  apiBaseUrl,
  currentOppPercent,
  directCostCents,
}: Props) {
  const router = useRouter();
  const [percent, setPercent] = useState(
    Math.round(currentOppPercent * 1_000) / 10, // 0.20 → 20.0
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview. percent is in display units (20 = 20%); convert to
  // multiplier for the markup math.
  const previewMultiplier = percent / 100;
  const previewBidTotal =
    directCostCents + Math.round(directCostCents * previewMultiplier);
  const currentBidTotal =
    directCostCents + Math.round(directCostCents * currentOppPercent);
  const delta = previewBidTotal - currentBidTotal;
  const dirty =
    Math.abs(percent - currentOppPercent * 100) > 0.05; // tolerate fp wobble

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${encodeURIComponent(estimateId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oppPercent: previewMultiplier }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPercent(Math.round(currentOppPercent * 1_000) / 10);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          What-if markup
        </h3>
        <span className="text-xs text-gray-500">
          Currently {(currentOppPercent * 100).toFixed(1)}% O&amp;P
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={50}
          step={0.5}
          value={percent}
          onChange={(e) => setPercent(Number.parseFloat(e.target.value))}
          className="flex-1 accent-blue-700"
        />
        <input
          type="number"
          min={0}
          max={200}
          step={0.5}
          value={percent}
          onChange={(e) => {
            const v = Number.parseFloat(e.target.value);
            if (Number.isFinite(v)) setPercent(v);
          }}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>

      <div className="mt-4 grid gap-3 rounded border border-gray-100 bg-gray-50 p-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Direct cost
          </div>
          <div className="font-mono font-semibold text-gray-800">
            {formatDollars(directCostCents)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Preview bid total
          </div>
          <div className="font-mono text-lg font-bold text-blue-700">
            {formatDollars(previewBidTotal)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Δ vs. current
          </div>
          <div
            className={`font-mono font-semibold ${
              delta === 0
                ? 'text-gray-700'
                : delta > 0
                  ? 'text-green-700'
                  : 'text-red-700'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {formatDollars(delta)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {error && <span className="text-xs text-red-700">{error}</span>}
        {dirty && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
          >
            Reset to current
          </button>
        )}
        <button
          type="button"
          onClick={apply}
          disabled={busy || !dirty}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy
            ? 'Applying…'
            : dirty
              ? `Apply ${percent.toFixed(1)}%`
              : 'No change'}
        </button>
      </div>
    </div>
  );
}

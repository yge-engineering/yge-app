'use client';

// Bid security editor.
//
// What the user sees: a small card showing what kind of security goes in
// the envelope, the amount due (auto-calculated from the bid total), the
// surety company + bond number fields, and a "no security required"
// toggle for private/task-order work.
//
// What it persists: a single `bidSecurity` field on the estimate. We
// PATCH the estimate-level endpoint with `{ bidSecurity }` on every
// commit. Clearing the security sends `bidSecurity: null` and the API
// strips the field from the on-disk record.

import { useEffect, useState } from 'react';
import {
  bidSecurityAmountCents,
  defaultBidSecurity,
  formatUSD,
  type BidSecurity,
  type BidSecurityType,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  bidTotalCents: number;
  apiBaseUrl: string;
  onUpdated: (estimate: PricedEstimate, totals: PricedEstimateTotals) => void;
}

const TYPE_OPTIONS: { value: BidSecurityType; label: string }[] = [
  { value: 'BID_BOND', label: 'Bid bond' },
  { value: 'CASHIERS_CHECK', label: "Cashier's check" },
  { value: 'CERTIFIED_CHECK', label: 'Certified check' },
  { value: 'OTHER', label: 'Other' },
];

export function BidSecurityEditor({
  estimate,
  bidTotalCents,
  apiBaseUrl,
  onUpdated,
}: Props) {
  const [security, setSecurity] = useState<BidSecurity | null>(
    estimate.bidSecurity ?? null,
  );
  const [percentText, setPercentText] = useState<string>(
    ((estimate.bidSecurity?.percent ?? 0.1) * 100).toFixed(1),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync if the parent estimate changes (e.g. after navigation back).
  useEffect(() => {
    setSecurity(estimate.bidSecurity ?? null);
    setPercentText(((estimate.bidSecurity?.percent ?? 0.1) * 100).toFixed(1));
  }, [estimate.bidSecurity]);

  const requiredCents = security
    ? bidSecurityAmountCents(bidTotalCents, security)
    : 0;

  async function persist(next: BidSecurity | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidSecurity: next }),
        },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      onUpdated(json.estimate, json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function patch(p: Partial<BidSecurity>) {
    if (!security) return;
    const next = { ...security, ...p };
    setSecurity(next);
    void persist(next);
  }

  function commitPercent() {
    if (!security) return;
    const n = Number(percentText);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setPercentText((security.percent * 100).toFixed(1));
      return;
    }
    const pct = n / 100;
    if (Math.abs(pct - security.percent) < 0.0001) return;
    patch({ percent: pct });
  }

  function turnOn() {
    const fresh = defaultBidSecurity();
    setSecurity(fresh);
    setPercentText('10.0');
    void persist(fresh);
  }

  function turnOff() {
    setSecurity(null);
    void persist(null);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Bid security
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            What goes in the envelope on bid day. CA public works almost always
            require 10% — without it the bid is non-responsive.
          </p>
        </div>
        {security ? (
          <button
            onClick={turnOff}
            className="text-xs text-gray-500 hover:text-red-700"
          >
            No security required
          </button>
        ) : (
          <button
            onClick={turnOn}
            className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
          >
            Add bid security
          </button>
        )}
      </header>

      {error && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          Couldn&rsquo;t save bid security: {error}
        </div>
      )}

      {!security ? (
        <p className="text-xs italic text-gray-500">
          No bid security configured. Most public works bids need 10% — click
          &ldquo;Add bid security&rdquo; above to start.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-yge-blue-200 bg-yge-blue-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Required amount
            </div>
            <div className="font-mono text-2xl font-bold text-yge-blue-700">
              {formatUSD(requiredCents)}
            </div>
            <div className="mt-1 text-xs text-gray-700">
              {(security.percent * 100).toFixed(1)}% of{' '}
              {formatUSD(bidTotalCents)}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-gray-700">
              <span className="mb-0.5 block font-medium">Type</span>
              <select
                value={security.type}
                onChange={(e) =>
                  patch({ type: e.target.value as BidSecurityType })
                }
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-gray-700">
              <span className="mb-0.5 block font-medium">Percent of bid</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={percentText}
                  onChange={(e) => setPercentText(e.target.value)}
                  onBlur={commitPercent}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                />
                <span className="text-sm text-gray-700">%</span>
              </div>
            </label>
          </div>

          {security.type === 'BID_BOND' && (
            <>
              <label className="block text-xs text-gray-700 md:col-span-2">
                <span className="mb-0.5 block font-medium">
                  Surety company name
                </span>
                <input
                  type="text"
                  value={security.suretyName ?? ''}
                  onChange={(e) =>
                    patch({ suretyName: e.target.value || undefined })
                  }
                  placeholder="e.g. Travelers Casualty and Surety Co. of America"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                />
              </label>
              <label className="block text-xs text-gray-700 md:col-span-2">
                <span className="mb-0.5 block font-medium">
                  Surety address
                </span>
                <input
                  type="text"
                  value={security.suretyAddress ?? ''}
                  onChange={(e) =>
                    patch({ suretyAddress: e.target.value || undefined })
                  }
                  placeholder="e.g. One Tower Square, Hartford, CT 06183"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                />
              </label>
              <label className="block text-xs text-gray-700">
                <span className="mb-0.5 block font-medium">Bond number</span>
                <input
                  type="text"
                  value={security.bondNumber ?? ''}
                  onChange={(e) =>
                    patch({ bondNumber: e.target.value || undefined })
                  }
                  placeholder="e.g. 107XYZ12345"
                  className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                />
              </label>
              <label className="block text-xs text-gray-700">
                <span className="mb-0.5 block font-medium">
                  Attorney-in-fact
                </span>
                <input
                  type="text"
                  value={security.attorneyInFact ?? ''}
                  onChange={(e) =>
                    patch({ attorneyInFact: e.target.value || undefined })
                  }
                  placeholder="Person who signs for the surety"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                />
              </label>
            </>
          )}

          <label className="block text-xs text-gray-700 md:col-span-2">
            <span className="mb-0.5 block font-medium">
              Internal notes <span className="text-gray-400">(not printed)</span>
            </span>
            <input
              type="text"
              value={security.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              placeholder='e.g. "Travelers — capacity confirmed Tuesday"'
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
            />
          </label>
        </div>
      )}

      {saving && (
        <div className="mt-2 text-right text-xs text-gray-400">saving…</div>
      )}
    </section>
  );
}

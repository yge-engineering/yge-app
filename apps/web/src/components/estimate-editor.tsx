'use client';

// Editable priced-estimate grid.
//
// Two interactions:
//   1. Inline unit-price editor on each line — debounced PATCH per row.
//   2. O&P percent input — debounced PATCH at the estimate level.
// Both responses come back with a fresh server-computed `totals` object so
// the running total is always sourced from the backend math, not browser
// arithmetic.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeEstimateTotals,
  formatUSD,
  pricedEstimateToCsv,
  type PricedEstimate,
  type PricedEstimateTotals,
  type PtoEItemConfidence,
  type SubBid,
} from '@yge/shared';
import { SubBidEditor } from './sub-bid-editor';
import { BidSecurityEditor } from './bid-security-editor';
import { AddendumEditor } from './addendum-editor';
import { BidChecklistBanner } from './bid-checklist-banner';

interface Props {
  initialEstimate: PricedEstimate;
  initialTotals: PricedEstimateTotals;
  apiBaseUrl: string;
}

export function EstimateEditor({ initialEstimate, initialTotals, apiBaseUrl }: Props) {
  const [estimate, setEstimate] = useState<PricedEstimate>(initialEstimate);
  const [totals, setTotals] = useState<PricedEstimateTotals>(initialTotals);
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const [savingOpp, setSavingOpp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic-ish: when the user types we recompute totals locally so the
  // running number doesn't lag, then reconcile with whatever the server
  // returns. Cheap and visually responsive.
  function recomputeLocal(next: PricedEstimate) {
    setTotals(computeEstimateTotals(next));
  }

  async function pushLineUpdate(itemIndex: number, unitPriceCents: number | null) {
    setSavingLine(itemIndex);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}/items/${itemIndex}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitPriceCents }),
        },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingLine(null);
    }
  }

  async function pushOppUpdate(oppPercent: number) {
    setSavingOpp(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/priced-estimates/${estimate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oppPercent }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingOpp(false);
    }
  }

  function safeFilename(): string {
    const slug = estimate.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return (slug || 'priced-estimate') + '-priced-estimate.csv';
  }

  function handleDownloadCsv() {
    const csv = pricedEstimateToCsv(estimate);
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{estimate.projectName}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {estimate.projectType.replace(/_/g, ' ')}
            {estimate.ownerAgency && <> &middot; {estimate.ownerAgency}</>}
            {estimate.location && <> &middot; {estimate.location}</>}
            {estimate.bidDueDate && <> &middot; bid due {estimate.bidDueDate}</>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              title="Download priced bid items + totals as a CSV"
            >
              Download CSV
            </button>
            <a
              href={`${apiBaseUrl}/api/priced-estimates/${estimate.id}/export.csv`}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Same CSV via direct API link — useful for emailing or scripted pulls"
            >
              CSV direct link
            </a>
            <a
              href={`/estimates/${estimate.id}/print`}
              className="rounded border border-yge-blue-500 bg-yge-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-yge-blue-700"
              title="Open the print-ready bid summary in a new tab"
              target="_blank"
              rel="noopener noreferrer"
            >
              Print bid summary
            </a>
            <a
              href={`/estimates/${estimate.id}/transmittal`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              title="Open the printable cover letter for the bid envelope"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cover letter
            </a>
            <a
              href={`/estimates/${estimate.id}/envelope`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              title="Open the printable bid envelope checklist (sealed bid form, license, DIR, security, addenda...)"
              target="_blank"
              rel="noopener noreferrer"
            >
              Envelope checklist
            </a>
          </div>
        </div>
        <TotalsCard totals={totals} oppPercent={estimate.oppPercent} />
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Couldn&rsquo;t save: {error}
        </div>
      )}

      <BidChecklistBanner estimate={estimate} totals={totals} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bid items
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">Extended</th>
                <th className="px-3 py-2">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimate.bidItems.map((item, i) => (
                <BidItemRow
                  key={i}
                  index={i}
                  item={item}
                  saving={savingLine === i}
                  onPriceCommit={(cents) => {
                    // Local update first for responsiveness.
                    const next = {
                      ...estimate,
                      bidItems: estimate.bidItems.map((it, idx) =>
                        idx === i ? { ...it, unitPriceCents: cents } : it,
                      ),
                    };
                    setEstimate(next);
                    recomputeLocal(next);
                    void pushLineUpdate(i, cents);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {totals.unpricedLineCount > 0
            ? `${totals.unpricedLineCount} line${totals.unpricedLineCount === 1 ? '' : 's'} still need pricing.`
            : 'All lines priced.'}
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Overhead &amp; profit
        </h2>
        <OppEditor
          oppPercent={estimate.oppPercent}
          saving={savingOpp}
          onCommit={(pct) => {
            const next = { ...estimate, oppPercent: pct };
            setEstimate(next);
            recomputeLocal(next);
            void pushOppUpdate(pct);
          }}
        />
      </section>

      <BidSecurityEditor
        estimate={estimate}
        bidTotalCents={totals.bidTotalCents}
        apiBaseUrl={apiBaseUrl}
        onUpdated={(nextEstimate, nextTotals) => {
          setEstimate(nextEstimate);
          setTotals(nextTotals);
        }}
      />

      <AddendumEditor
        estimate={estimate}
        apiBaseUrl={apiBaseUrl}
        onUpdated={(nextEstimate, nextTotals) => {
          setEstimate(nextEstimate);
          setTotals(nextTotals);
        }}
      />

      <SubBidEditor
        estimate={estimate}
        bidTotalCents={totals.bidTotalCents}
        apiBaseUrl={apiBaseUrl}
        onSubsUpdated={(subs: SubBid[]) => {
          setEstimate((prev) => ({ ...prev, subBids: subs }));
        }}
      />
    </div>
  );
}

// ---- Subcomponents -------------------------------------------------------

function TotalsCard({
  totals,
  oppPercent,
}: {
  totals: PricedEstimateTotals;
  oppPercent: number;
}) {
  return (
    <div className="rounded-lg border border-yge-blue-500 bg-yge-blue-50 p-4 text-right shadow-sm">
      <dl className="text-xs text-gray-700">
        <div className="flex justify-between gap-4">
          <dt>Direct cost</dt>
          <dd className="font-mono">{formatUSD(totals.directCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>O&amp;P ({(oppPercent * 100).toFixed(1)}%)</dt>
          <dd className="font-mono">{formatUSD(totals.oppCents)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t border-yge-blue-500 pt-1 text-base font-bold text-yge-blue-700">
          <dt>Bid total</dt>
          <dd className="font-mono">{formatUSD(totals.bidTotalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}

function confidenceClasses(c: PtoEItemConfidence): string {
  if (c === 'HIGH') return 'bg-green-100 text-green-800';
  if (c === 'MEDIUM') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function BidItemRow({
  index,
  item,
  saving,
  onPriceCommit,
}: {
  index: number;
  item: PricedEstimate['bidItems'][number];
  saving: boolean;
  onPriceCommit: (cents: number | null) => void;
}) {
  const [text, setText] = useState<string>(
    item.unitPriceCents == null ? '' : (item.unitPriceCents / 100).toFixed(2),
  );

  // If parent updates the price (e.g. after server round-trip), keep input in sync.
  // Skipped while the user is actively typing — onChange handles that case.
  const lastServerCents = useRef(item.unitPriceCents);
  useEffect(() => {
    if (item.unitPriceCents !== lastServerCents.current) {
      lastServerCents.current = item.unitPriceCents;
      setText(item.unitPriceCents == null ? '' : (item.unitPriceCents / 100).toFixed(2));
    }
  }, [item.unitPriceCents]);

  const extendedCents = useMemo(() => {
    if (item.unitPriceCents == null) return 0;
    return Math.round(item.quantity * item.unitPriceCents);
  }, [item.quantity, item.unitPriceCents]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === '') {
      onPriceCommit(null);
      return;
    }
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars) || dollars < 0) {
      // Reset to last known value.
      setText(item.unitPriceCents == null ? '' : (item.unitPriceCents / 100).toFixed(2));
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents === item.unitPriceCents) return; // no change, skip server call
    onPriceCommit(cents);
  }

  return (
    <tr className={item.unitPriceCents == null ? 'bg-yellow-50/40' : ''}>
      <td className="px-3 py-2 align-top text-xs text-gray-500">{item.itemNumber}</td>
      <td className="px-3 py-2 align-top">
        <div className="text-sm text-gray-900">{item.description}</div>
        {item.pageReference && (
          <div className="text-xs text-gray-500">{item.pageReference}</div>
        )}
        {item.notes && (
          <div className="mt-0.5 text-xs italic text-gray-500">{item.notes}</div>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-sm text-gray-700">
        {item.quantity.toLocaleString()}
      </td>
      <td className="px-3 py-2 align-top text-xs text-gray-600">{item.unit}</td>
      <td className="px-3 py-2 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs text-gray-500">$</span>
          <input
            aria-label={`Unit price for item ${item.itemNumber}`}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="—"
            className="w-24 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
          />
        </div>
        {saving && <div className="mt-0.5 text-[10px] text-gray-400">saving…</div>}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-sm text-gray-900">
        {item.unitPriceCents == null ? (
          <span className="text-gray-300">—</span>
        ) : (
          formatUSD(extendedCents)
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceClasses(item.confidence)}`}
        >
          {item.confidence}
        </span>
      </td>
    </tr>
  );
}

function OppEditor({
  oppPercent,
  saving,
  onCommit,
}: {
  oppPercent: number;
  saving: boolean;
  onCommit: (pct: number) => void;
}) {
  const [text, setText] = useState((oppPercent * 100).toFixed(1));

  useEffect(() => {
    setText((oppPercent * 100).toFixed(1));
  }, [oppPercent]);

  function commit() {
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0 || n > 200) {
      setText((oppPercent * 100).toFixed(1));
      return;
    }
    const pct = n / 100;
    if (Math.abs(pct - oppPercent) < 0.0001) return;
    onCommit(pct);
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="opp-pct" className="text-sm text-gray-700">
        Markup
      </label>
      <input
        id="opp-pct"
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      />
      <span className="text-sm text-gray-700">%</span>
      {saving && <span className="text-xs text-gray-400">saving…</span>}
      <p className="ml-4 text-xs text-gray-500">
        Applied on top of every priced line. Adjust freely while bidding.
      </p>
    </div>
  );
}

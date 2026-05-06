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
import { useTranslator, type Translator } from '../lib/use-translator';
import {
  buildupUnitPriceCents,
  computeBidRiskScore,
  computeEstimateTotals,
  formatUSD,
  pricedEstimateToCsv,
  type CostBuildup,
  type PricedEstimate,
  type PricedEstimateTotals,
  type PtoEItemConfidence,
  type SubBid,
} from '@yge/shared';
import { SubBidEditor } from './sub-bid-editor';
import { BidSecurityEditor } from './bid-security-editor';
import { AddendumEditor } from './addendum-editor';
import { BidChecklistBanner } from './bid-checklist-banner';
import { CostBuildupDrawer } from './cost-buildup-drawer';
import { MarkupStackEditor } from './markup-stack-editor';
import { HistoricalPricesPopover } from './historical-prices-popover';
import { ExplainLinePopover } from './explain-line-popover';

interface Props {
  initialEstimate: PricedEstimate;
  initialTotals: PricedEstimateTotals;
  apiBaseUrl: string;
}

export function EstimateEditor({ initialEstimate, initialTotals, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [estimate, setEstimate] = useState<PricedEstimate>(initialEstimate);
  const [totals, setTotals] = useState<PricedEstimateTotals>(initialTotals);
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const [savingOpp, setSavingOpp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to every unit-price input in the bid items table. Used to
  // implement Excel-style keyboard nav (Enter / Tab / arrow keys move
  // between rows). Length tracks bidItems on every render via the
  // data-row-idx prop on each input.
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Crew-buildup drawer state. Index of the row whose buildup is open,
  // or null if no drawer.
  const [buildupRowIdx, setBuildupRowIdx] = useState<number | null>(null);

  // Filter for AI-drafted line review. The editor surfaces a
  // "Show unreviewed only" toggle so the estimator can run down the
  // list once after a Plans-to-Estimate draft lands and approve each
  // line without staring at the rows they already accepted.
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);

  // Bulk-select state. selectedIndices is the set of currently
  // selected row indices; lastSelectedIdx is used for shift-click
  // range selects. The bulk-actions toolbar shows up when size > 0.
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  function toggleRowSelected(idx: number, shift: boolean) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (shift && lastSelectedIdx != null) {
        const lo = Math.min(lastSelectedIdx, idx);
        const hi = Math.max(lastSelectedIdx, idx);
        for (let i = lo; i <= hi; i += 1) next.add(i);
      } else if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
    setLastSelectedIdx(idx);
  }

  function clearSelection() {
    setSelectedIndices(new Set());
    setLastSelectedIdx(null);
  }

  // Apply a partial bid-item patch to every selected row, batched
  // through the same applyItemPatch helper used by the inline
  // controls.
  async function bulkApply(patch: Partial<PricedEstimate['bidItems'][number]>) {
    const ids = Array.from(selectedIndices).sort((a, b) => a - b);
    for (const i of ids) {
      // eslint-disable-next-line no-await-in-loop
      await applyItemPatch(i, patch);
    }
  }

  // Multiply selected rows' quantities by a constant. Useful for a
  // "scale this whole schedule by 1.1" sweep.
  async function bulkMultiplyQty(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const ids = Array.from(selectedIndices).sort((a, b) => a - b);
    for (const i of ids) {
      const item = estimate.bidItems[i];
      if (!item) continue;
      // eslint-disable-next-line no-await-in-loop
      await applyItemPatch(i, {
        quantity: Math.round(item.quantity * factor * 1000) / 1000,
      });
    }
  }

  // Variance map: itemIndex → { median, deviation, count }. Fetched
  // once on mount and again any time the bid items array length
  // changes (paste-splat / template clone). Threshold is 50% in
  // either direction — far enough off that it's worth a yellow chip
  // but not so tight every reasonable bid lights up.
  type VarianceRow = {
    historicalMedianCents: number | null;
    historicalCount: number;
    deviation: number | null;
  };
  const [variance, setVariance] = useState<Record<number, VarianceRow>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/priced-estimates/${encodeURIComponent(estimate.id)}/variance`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          rows: Array<{
            itemIndex: number;
            historicalMedianCents: number | null;
            historicalCount: number;
            deviation: number | null;
          }>;
        };
        if (cancelled) return;
        const map: Record<number, VarianceRow> = {};
        for (const r of json.rows) {
          map[r.itemIndex] = {
            historicalMedianCents: r.historicalMedianCents,
            historicalCount: r.historicalCount,
            deviation: r.deviation,
          };
        }
        setVariance(map);
      } catch {
        // Silent — variance is a non-critical decoration.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate.id, estimate.bidItems.length]);

  const visibleRowFilter = (item: PricedEstimate['bidItems'][number]) =>
    !showUnreviewedOnly ||
    item.reviewState !== 'accepted';

  // Cell-level undo stack. Each entry captures the row index and the
  // old unit price in cents so ⌘Z (Cmd/Ctrl-Z) reverts the most recent
  // edit. Capped at 50 entries — that's plenty for "I overwrote the
  // wrong cell" recovery without unbounded memory.
  type UndoEntry = { itemIndex: number; oldCents: number | null };
  const undoStack = useRef<UndoEntry[]>([]);

  function pushUndo(entry: UndoEntry) {
    undoStack.current.push(entry);
    if (undoStack.current.length > 50) undoStack.current.shift();
  }

  function popUndo(): UndoEntry | null {
    return undoStack.current.pop() ?? null;
  }

  // Move keyboard focus to a sibling row's price input. Direction is
  // the row delta (+1 down, -1 up). Wraps to the first/last row.
  function focusRow(currentIndex: number, direction: 1 | -1) {
    const total = inputRefs.current.length;
    if (total === 0) return;
    let next = currentIndex + direction;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    const el = inputRefs.current[next];
    if (el) {
      el.focus();
      el.select();
    }
  }

  // Optimistic-ish: when the user types we recompute totals locally so the
  // running number doesn't lag, then reconcile with whatever the server
  // returns. Cheap and visually responsive.
  function recomputeLocal(next: PricedEstimate) {
    setTotals(computeEstimateTotals(next));
  }

  // Apply a unit-price change for a row, mirroring what the inline
  // input would do. Used by paste-from-Excel and undo.
  function applyPriceChange(itemIndex: number, cents: number | null, opts?: { skipUndo?: boolean }) {
    const existing = estimate.bidItems[itemIndex];
    if (!existing) return;
    if (existing.unitPriceCents === cents) return;
    if (!opts?.skipUndo) {
      pushUndo({ itemIndex, oldCents: existing.unitPriceCents });
    }
    const next = {
      ...estimate,
      bidItems: estimate.bidItems.map((it, idx) =>
        idx === itemIndex ? { ...it, unitPriceCents: cents } : it,
      ),
    };
    setEstimate(next);
    recomputeLocal(next);
    void pushLineUpdate(itemIndex, cents);
  }

  // Handle a multi-line paste from Excel. Pastes a column of unit
  // prices starting at the current row, one per subsequent row, until
  // we run out of pasted lines or run off the end of the sheet.
  function applyMultiLinePaste(startIndex: number, raw: string): number {
    // Excel newlines come through as \r\n; some browsers normalize to
    // \n. Trim each cell, drop trailing blanks.
    const lines = raw.replace(/\r/g, '').split('\n').map((s) => s.trim());
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    let applied = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const idx = startIndex + i;
      if (idx >= estimate.bidItems.length) break;
      const line = lines[i] ?? '';
      const num = Number(line.replace(/[$,\s]/g, ''));
      const cents = !line || !Number.isFinite(num) || num < 0 ? null : Math.round(num * 100);
      applyPriceChange(idx, cents);
      applied += 1;
    }
    return applied;
  }

  function handleUndo() {
    const entry = popUndo();
    if (!entry) return;
    applyPriceChange(entry.itemIndex, entry.oldCents, { skipUndo: true });
  }

  // Patch one component of the markup stack and PATCH the whole
  // estimate. Components round-trip through the same endpoint as O&P.
  async function applyMarkupChange(
    key:
      | 'laborBurdenPct'
      | 'equipmentBurdenPct'
      | 'subMarkupPct'
      | 'bondPct'
      | 'insurancePct'
      | 'contingencyPct',
    decimal: number,
  ) {
    const current = estimate.markup ?? {
      laborBurdenPct: 0,
      equipmentBurdenPct: 0,
      subMarkupPct: 0,
      bondPct: 0,
      insurancePct: 0,
      contingencyPct: 0,
    };
    const nextMarkup = { ...current, [key]: decimal };
    const next = { ...estimate, markup: nextMarkup };
    setEstimate(next);
    recomputeLocal(next);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markup: nextMarkup }),
        },
      );
      if (!res.ok)
        throw new Error(t('estEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('estEditor.errFallback'));
    }
  }

  // Update arbitrary fields on a single bid item (schedule, isAlternate,
  // costBuildup) and PATCH the whole bidItems array. The endpoint's
  // payload is small in practice and this keeps the on-disk shape
  // atomic.
  async function applyItemPatch(
    itemIndex: number,
    patch: Partial<PricedEstimate['bidItems'][number]>,
  ) {
    const existing = estimate.bidItems[itemIndex];
    if (!existing) return;
    const next = {
      ...estimate,
      bidItems: estimate.bidItems.map((it, idx) =>
        idx === itemIndex ? { ...it, ...patch } : it,
      ),
    };
    setEstimate(next);
    recomputeLocal(next);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidItems: next.bidItems }),
        },
      );
      if (!res.ok) throw new Error(t('estEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('estEditor.errFallback'));
    }
  }

  // Save just the costBuildup of one row. Updates locally then fires
  // a PATCH with the whole bidItems array (the existing endpoint's
  // shape) — small enough not to matter, atomic at the file level.
  async function applyBuildupChange(itemIndex: number, buildup: CostBuildup) {
    const existing = estimate.bidItems[itemIndex];
    if (!existing) return;
    const next = {
      ...estimate,
      bidItems: estimate.bidItems.map((it, idx) =>
        idx === itemIndex ? { ...it, costBuildup: buildup } : it,
      ),
    };
    setEstimate(next);
    recomputeLocal(next);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidItems: next.bidItems }),
        },
      );
      if (!res.ok) throw new Error(t('estEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('estEditor.errFallback'));
    }
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
      if (!res.ok) throw new Error(t('estEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('estEditor.errFallback'));
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
      if (!res.ok) throw new Error(t('estEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      setEstimate(json.estimate);
      setTotals(json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('estEditor.errFallback'));
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
            {estimate.ownerAgency && t('estEditor.subtitleAgency', { agency: estimate.ownerAgency })}
            {estimate.location && t('estEditor.subtitleLocation', { location: estimate.location })}
            {estimate.bidDueDate && t('estEditor.subtitleBidDue', { date: estimate.bidDueDate })}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              title={t('estEditor.downloadCsvTip')}
            >
              {t('estEditor.downloadCsv')}
            </button>
            <a
              href={`${apiBaseUrl}/api/priced-estimates/${estimate.id}/export.csv`}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title={t('estEditor.csvDirectTip')}
            >
              {t('estEditor.csvDirect')}
            </a>
            <a
              href={`/estimates/${estimate.id}/print`}
              className="rounded border border-yge-blue-500 bg-yge-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-yge-blue-700"
              title={t('estEditor.printSummaryTip')}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('estEditor.printSummary')}
            </a>
            <a
              href={`/estimates/${estimate.id}/transmittal`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              title={t('estEditor.coverLetterTip')}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('estEditor.coverLetter')}
            </a>
            <a
              href={`/estimates/${estimate.id}/envelope`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              title={t('estEditor.envelopeTip')}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('estEditor.envelope')}
            </a>
          </div>
        </div>
        <TotalsCard totals={totals} oppPercent={estimate.oppPercent} t={t} />
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {t('estEditor.errSave', { error })}
        </div>
      )}

      <BidChecklistBanner estimate={estimate} totals={totals} />
      <BidRiskBanner estimate={estimate} totals={totals} />

      <section>
        {selectedIndices.size > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-yge-blue-300 bg-yge-blue-50 px-3 py-2 text-xs">
            <span className="font-semibold text-yge-blue-900">
              {selectedIndices.size} row{selectedIndices.size === 1 ? '' : 's'} selected
            </span>
            <span className="text-yge-blue-800">
              · sum{' '}
              {formatUSD(
                Array.from(selectedIndices).reduce((acc, i) => {
                  const it = estimate.bidItems[i];
                  if (!it || it.unitPriceCents == null) return acc;
                  return acc + Math.round(it.quantity * it.unitPriceCents);
                }, 0),
              )}
            </span>
            <span className="ml-2 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const raw = window.prompt(
                    'Set markup % on selected lines (blank to clear override):',
                    (estimate.oppPercent * 100).toFixed(1),
                  );
                  if (raw == null) return;
                  if (raw.trim() === '') {
                    void bulkApply({ markupPct: undefined });
                    return;
                  }
                  const n = Number(raw.replace(/[%,\s]/g, ''));
                  if (!Number.isFinite(n) || n < 0 || n > 200) return;
                  void bulkApply({ markupPct: n / 100 });
                }}
                className="rounded border border-yge-blue-500 bg-white px-2 py-0.5 font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              >
                Apply markup %
              </button>
              <button
                type="button"
                onClick={() => {
                  const raw = window.prompt(
                    'Multiply quantities by (e.g. 1.1 for +10%):',
                    '1.0',
                  );
                  if (raw == null) return;
                  const f = Number(raw);
                  if (!Number.isFinite(f) || f <= 0) return;
                  void bulkMultiplyQty(f);
                }}
                className="rounded border border-yge-blue-500 bg-white px-2 py-0.5 font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              >
                Multiply qty
              </button>
              <button
                type="button"
                onClick={() => void bulkApply({ reviewState: 'accepted' })}
                className="rounded border border-green-700 bg-white px-2 py-0.5 font-medium text-green-700 hover:bg-green-50"
              >
                Mark accepted
              </button>
              <button
                type="button"
                onClick={() => void bulkApply({ reviewState: 'flagged' })}
                className="rounded border border-amber-500 bg-white px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-50"
              >
                Flag
              </button>
              <button
                type="button"
                onClick={() => void bulkApply({ isAlternate: true })}
                className="rounded border border-gray-300 bg-white px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-100"
              >
                Mark alternate
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-2 rounded px-2 py-0.5 text-gray-600 hover:bg-gray-200"
              >
                Clear
              </button>
            </span>
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('estEditor.bidItemsHeader')}
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-600">
              {(() => {
                const total = estimate.bidItems.length;
                const accepted = estimate.bidItems.filter(
                  (it) => it.reviewState === 'accepted',
                ).length;
                const flagged = estimate.bidItems.filter(
                  (it) => it.reviewState === 'flagged',
                ).length;
                return (
                  <>
                    <span className="font-mono">
                      {accepted}/{total}
                    </span>{' '}
                    reviewed
                    {flagged > 0 && (
                      <>
                        {' '}
                        ·{' '}
                        <span className="font-mono text-amber-700">
                          {flagged}
                        </span>{' '}
                        flagged
                      </>
                    )}
                  </>
                );
              })()}
            </span>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={showUnreviewedOnly}
                onChange={(e) => setShowUnreviewedOnly(e.target.checked)}
              />
              <span className="text-gray-700">Show unreviewed only</span>
            </label>
          </div>
        </div>
        {/* The table sits inside a max-h scroller so the header and the
            totals footer stay pinned while the line items scroll. The
            sticky positioning on <thead> + <tfoot> is what an
            estimator coming from Excel expects: column labels at the
            top, running totals at the bottom, both always visible. */}
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={
                      selectedIndices.size > 0 &&
                      selectedIndices.size === estimate.bidItems.length
                    }
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          selectedIndices.size > 0 &&
                          selectedIndices.size < estimate.bidItems.length;
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIndices(
                          new Set(estimate.bidItems.map((_, i) => i)),
                        );
                      } else {
                        clearSelection();
                      }
                    }}
                    aria-label="Select all rows"
                  />
                </th>
                <th className="px-3 py-2">{t('estEditor.thNum')}</th>
                <th className="px-3 py-2">{t('estEditor.thDescription')}</th>
                <th className="px-3 py-2 text-right">{t('estEditor.thQty')}</th>
                <th className="px-3 py-2">{t('estEditor.thUnit')}</th>
                <th className="px-3 py-2 text-right">{t('estEditor.thUnitPrice')}</th>
                <th className="px-3 py-2 text-right">{t('estEditor.thExtended')}</th>
                <th className="px-3 py-2">{t('estEditor.thConf')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimate.bidItems
                .map((item, i) => ({ item, i }))
                .filter(({ item }) => visibleRowFilter(item))
                .map(({ item, i }) => (
                <BidItemRow
                  key={i}
                  index={i}
                  totalRows={estimate.bidItems.length}
                  t={t}
                  item={item}
                  saving={savingLine === i}
                  inputRef={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  onPriceCommit={(cents) => applyPriceChange(i, cents)}
                  onAdvance={(direction) => focusRow(i, direction)}
                  onUndo={handleUndo}
                  onMultiLinePaste={(raw) => applyMultiLinePaste(i, raw)}
                  onOpenBuildup={() => setBuildupRowIdx(i)}
                  onScheduleChange={(schedule) =>
                    void applyItemPatch(i, {
                      schedule: schedule.trim() ? schedule : undefined,
                    })
                  }
                  onAlternateChange={(alt) =>
                    void applyItemPatch(i, { isAlternate: alt })
                  }
                  onReviewStateChange={(state) =>
                    void applyItemPatch(i, { reviewState: state })
                  }
                  onMarkupChange={(pct) =>
                    void applyItemPatch(i, { markupPct: pct })
                  }
                  defaultMarkupPct={estimate.oppPercent}
                  variance={variance[i]}
                  selected={selectedIndices.has(i)}
                  onToggleSelected={(shift) => toggleRowSelected(i, shift)}
                  apiBaseUrl={apiBaseUrl}
                  estimateId={estimate.id}
                  projectType={estimate.projectType}
                />
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-gray-50 text-sm font-semibold text-gray-900 shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
              {/* Per-schedule subtotals — only render when there's
                  actually more than one schedule in the bid (otherwise
                  the Direct row below covers it). */}
              {Object.keys(totals.perSchedule).filter((k) => k !== '').length > 0 && (
                <>
                  {Object.entries(totals.perSchedule)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, cents]) => (
                      <tr key={`sch-${key}`}>
                        <td
                          className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500"
                          colSpan={6}
                        >
                          {key === '' ? '(unscheduled)' : key}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-xs text-gray-700">
                          {formatUSD(cents)}
                        </td>
                        <td />
                      </tr>
                    ))}
                </>
              )}
              <tr>
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500" colSpan={6}>
                  {t('estEditor.totalsDirect')}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatUSD(totals.directCents)}
                </td>
                <td />
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500" colSpan={6}>
                  {t('estEditor.totalsOpp', {
                    percent: (estimate.oppPercent * 100).toFixed(1),
                  })}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatUSD(totals.oppCents)}
                </td>
                <td />
              </tr>
              <tr className="border-t-2 border-gray-300">
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-yge-blue-700" colSpan={6}>
                  {t('estEditor.totalsBid')}
                </td>
                <td className="px-3 py-2 text-right font-mono text-base text-yge-blue-700">
                  {formatUSD(totals.bidTotalCents)}
                </td>
                <td />
              </tr>
              {totals.alternateCents > 0 && (
                <tr>
                  <td
                    className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500"
                    colSpan={6}
                  >
                    Alternates (not in base bid)
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-xs text-gray-700">
                    {formatUSD(totals.alternateCents)}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {totals.unpricedLineCount > 0
            ? totals.unpricedLineCount === 1
              ? t('estEditor.unpricedOne')
              : t('estEditor.unpricedMany', { count: totals.unpricedLineCount })
            : t('estEditor.allPriced')}
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('estEditor.opHeader')}
        </h2>
        <OppEditor
          oppPercent={estimate.oppPercent}
          saving={savingOpp}
          t={t}
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

      <MarkupStackEditor
        markup={estimate.markup}
        breakdown={totals.markupBreakdown}
        saving={savingOpp}
        onCommit={(key, decimal) => void applyMarkupChange(key, decimal)}
      />

      <SubBidEditor
        estimate={estimate}
        bidTotalCents={totals.bidTotalCents}
        apiBaseUrl={apiBaseUrl}
        onSubsUpdated={(subs: SubBid[]) => {
          setEstimate((prev) => ({ ...prev, subBids: subs }));
        }}
      />

      {/* Crew buildup drawer overlay. Mounted only when a row is open
          so unmount fires the buildup component's cleanup on close. */}
      {buildupRowIdx !== null && estimate.bidItems[buildupRowIdx] && (
        <CostBuildupDrawer
          item={estimate.bidItems[buildupRowIdx]!}
          onClose={() => setBuildupRowIdx(null)}
          onSave={(b) => applyBuildupChange(buildupRowIdx, b)}
          onApplyUnitPrice={(c) => applyPriceChange(buildupRowIdx, c)}
        />
      )}
    </div>
  );
}

// ---- Subcomponents -------------------------------------------------------

function TotalsCard({
  totals,
  oppPercent,
  t,
}: {
  totals: PricedEstimateTotals;
  oppPercent: number;
  t: Translator;
}) {
  return (
    <div className="rounded-lg border border-yge-blue-500 bg-yge-blue-50 p-4 text-right shadow-sm">
      <dl className="text-xs text-gray-700">
        <div className="flex justify-between gap-4">
          <dt>{t('estEditor.totalsDirect')}</dt>
          <dd className="font-mono">{formatUSD(totals.directCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t('estEditor.totalsOpp', { percent: (oppPercent * 100).toFixed(1) })}</dt>
          <dd className="font-mono">{formatUSD(totals.oppCents)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-4 border-t border-yge-blue-500 pt-1 text-base font-bold text-yge-blue-700">
          <dt>{t('estEditor.totalsBid')}</dt>
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
  totalRows,
  item,
  saving,
  inputRef,
  onPriceCommit,
  onAdvance,
  onUndo,
  onMultiLinePaste,
  onOpenBuildup,
  onScheduleChange,
  onAlternateChange,
  onReviewStateChange,
  onMarkupChange,
  defaultMarkupPct,
  variance,
  selected,
  onToggleSelected,
  apiBaseUrl,
  estimateId,
  projectType,
  t,
}: {
  index: number;
  totalRows: number;
  item: PricedEstimate['bidItems'][number];
  saving: boolean;
  /** Ref callback so the parent can manage focus across all rows. */
  inputRef: (el: HTMLInputElement | null) => void;
  onPriceCommit: (cents: number | null) => void;
  /** Move keyboard focus to the prev/next row. +1 down, -1 up. */
  onAdvance: (direction: 1 | -1) => void;
  /** Cell-level undo. Reverts the most recent change anywhere in the table. */
  onUndo: () => void;
  /** Paste-from-Excel splat. Returns the number of rows that absorbed the paste. */
  onMultiLinePaste: (raw: string) => number;
  /** Open the crew-buildup drawer for this row. */
  onOpenBuildup: () => void;
  /** Update the schedule label for this line. Empty string clears it. */
  onScheduleChange: (schedule: string) => void;
  /** Toggle the line's alternate flag. */
  onAlternateChange: (alt: boolean) => void;
  /** Update the AI-draft review state. undefined = unreviewed. */
  onReviewStateChange: (state: 'accepted' | 'flagged' | undefined) => void;
  /** Update the per-line markup override. undefined = inherit default. */
  onMarkupChange: (pct: number | undefined) => void;
  /** Estimate-level default markup, shown as the placeholder when this
   *  line has no override. */
  defaultMarkupPct: number;
  /** Historical-price variance for this row. Undefined while the
   *  variance call is in flight. */
  variance:
    | {
        historicalMedianCents: number | null;
        historicalCount: number;
        deviation: number | null;
      }
    | undefined;
  /** Bulk-select state for this row. */
  selected: boolean;
  onToggleSelected: (shift: boolean) => void;
  /** Passed through to the History popover so it can fetch and so the
   *  estimator's current estimate doesn't echo back in the matches. */
  apiBaseUrl: string;
  estimateId: string;
  projectType: string;
  t: Translator;
}) {
  // totalRows is only consumed as documentation right now; surfaced
  // here so the row component knows when it's the last one without
  // having to look it up from outside.
  void totalRows;

  // Per-row history popover open/closed state.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Per-row AI-explain popover open/closed state.
  const [explainOpen, setExplainOpen] = useState(false);
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

  // Variance threshold: if the current unit price is more than 50%
  // off the historical median, tint the row amber so the estimator
  // can spot a typo at a glance. The tooltip on the input cell shows
  // the median + match count. Don't override the unpriced-yellow
  // tint; that's a different, blocking signal.
  const variancePct =
    variance?.deviation != null ? Math.abs(variance.deviation) : null;
  const varianceFlagged =
    variance != null && variancePct != null && variancePct >= 0.5;
  const rowClass =
    item.unitPriceCents == null
      ? 'bg-yellow-50/40'
      : varianceFlagged
        ? 'bg-amber-50'
        : '';

  return (
    <tr className={`${rowClass}${selected ? ' bg-yge-blue-50/40' : ''}`}>
      <td className="w-8 px-2 py-2 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelected((e.nativeEvent as MouseEvent).shiftKey)}
          aria-label={`Select bid item ${item.itemNumber}`}
        />
      </td>
      <td className="px-3 py-2 align-top text-xs text-gray-500">{item.itemNumber}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm text-gray-900">{item.description}</div>
          <button
            type="button"
            onClick={onOpenBuildup}
            title="Open crew buildup for this line"
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              item.costBuildup
                ? 'border-yge-blue-500 text-yge-blue-700 hover:bg-yge-blue-50'
                : 'border-gray-300 text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700'
            }`}
          >
            {item.costBuildup ? '📊 Buildup' : '+ Buildup'}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
          <input
            value={item.schedule ?? ''}
            onChange={(e) => onScheduleChange(e.target.value)}
            placeholder="Schedule (optional)"
            className="w-32 rounded border border-gray-200 px-1 py-0.5 text-[10px]"
            aria-label="Schedule"
          />
          <label className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide">
            <input
              type="checkbox"
              checked={Boolean(item.isAlternate)}
              onChange={(e) => onAlternateChange(e.target.checked)}
            />
            <span>Alternate</span>
          </label>
          <MarkupOverrideField
            value={item.markupPct}
            defaultPct={defaultMarkupPct}
            onCommit={onMarkupChange}
          />
        </div>
        {item.pageReference && (
          <div className="text-xs text-gray-500">{item.pageReference}</div>
        )}
        {item.notes && (
          <div className="mt-0.5 text-xs italic text-gray-500">{item.notes}</div>
        )}
        {item.costBuildup &&
          (() => {
            const calc = buildupUnitPriceCents(item.costBuildup, item.quantity);
            if (calc == null) return null;
            return (
              <div className="mt-1 text-[11px] text-gray-500">
                Calculated:{' '}
                <span className="font-mono text-yge-blue-700">
                  {formatUSD(calc)}
                </span>{' '}
                / {item.unit}
              </div>
            );
          })()}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-sm text-gray-700">
        {item.quantity.toLocaleString()}
      </td>
      <td className="px-3 py-2 align-top text-xs text-gray-600">{item.unit}</td>
      <td className="relative px-3 py-2 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setExplainOpen((v) => !v)}
            title="Ask the AI what this line typically covers"
            className="rounded border border-gray-300 px-1 py-0.5 text-[10px] text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700"
          >
            ❓
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Show what we bid for similar lines on past jobs"
            className="rounded border border-gray-300 px-1 py-0.5 text-[10px] text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700"
          >
            🕐
          </button>
          <span className="text-xs text-gray-500">$</span>
          <input
            ref={inputRef}
            aria-label={t('estEditor.unitPriceAria', { itemNumber: item.itemNumber })}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onPaste={(e) => {
              const raw = e.clipboardData.getData('text/plain');
              // Excel cells separated by newline are the most common
              // multi-row paste. If we see a newline, intercept the
              // default and splat across rows.
              if (raw.includes('\n')) {
                e.preventDefault();
                onMultiLinePaste(raw);
              }
            }}
            onKeyDown={(e) => {
              // ⌘Z / Ctrl+Z — undo the last cell change anywhere in
              // the table. We let the browser handle in-cell undo
              // (i.e. while the user is typing) by only reacting when
              // the input is unchanged from its committed value.
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                onUndo();
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
                onAdvance(e.shiftKey ? -1 : 1);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                commit();
                onAdvance(1);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                commit();
                onAdvance(-1);
                return;
              }
              // Tab: let the browser handle horizontal nav (focus next
              // tab-stop), but commit first so the value isn't lost.
              if (e.key === 'Tab') {
                commit();
                return;
              }
            }}
            placeholder="—"
            className="w-24 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
          />
        </div>
        {saving && <div className="mt-0.5 text-[10px] text-gray-400">{t('estEditor.savingShort')}</div>}
        {varianceFlagged && variance && (
          <div
            className="mt-0.5 text-[10px] text-amber-700"
            title={`Median of ${variance.historicalCount} past bid${
              variance.historicalCount === 1 ? '' : 's'
            }: ${formatUSD(variance.historicalMedianCents ?? 0)}`}
          >
            ⚠ {variance.deviation! > 0 ? '+' : ''}
            {(variance.deviation! * 100).toFixed(0)}% vs past
          </div>
        )}
        {historyOpen && (
          <HistoricalPricesPopover
            apiBaseUrl={apiBaseUrl}
            description={item.description}
            unit={item.unit}
            projectType={projectType}
            excludeEstimateId={estimateId}
            onPick={(cents) => onPriceCommit(cents)}
            onClose={() => setHistoryOpen(false)}
          />
        )}
        {explainOpen && (
          <ExplainLinePopover
            apiBaseUrl={apiBaseUrl}
            estimateId={estimateId}
            itemIndex={index}
            currentUnitCentsHint={
              text.trim() === '' ? undefined : Math.round(Number(text) * 100)
            }
            onClose={() => setExplainOpen(false)}
          />
        )}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-sm text-gray-900">
        {item.unitPriceCents == null ? (
          <span className="text-gray-300">—</span>
        ) : (
          formatUSD(extendedCents)
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col items-start gap-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceClasses(item.confidence)}`}
          >
            {item.confidence}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onReviewStateChange(
                  item.reviewState === 'accepted' ? undefined : 'accepted',
                )
              }
              title="Mark this line as reviewed"
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                item.reviewState === 'accepted'
                  ? 'bg-green-700 text-white'
                  : 'border border-gray-300 text-gray-500 hover:border-green-700 hover:text-green-700'
              }`}
            >
              {item.reviewState === 'accepted' ? '✓ OK' : 'OK?'}
            </button>
            <button
              type="button"
              onClick={() =>
                onReviewStateChange(
                  item.reviewState === 'flagged' ? undefined : 'flagged',
                )
              }
              title="Flag for another look"
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                item.reviewState === 'flagged'
                  ? 'bg-amber-500 text-white'
                  : 'border border-gray-300 text-gray-500 hover:border-amber-500 hover:text-amber-700'
              }`}
            >
              ⚠
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function OppEditor({
  oppPercent,
  saving,
  onCommit,
  t,
}: {
  oppPercent: number;
  saving: boolean;
  onCommit: (pct: number) => void;
  t: Translator;
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
        {t('estEditor.lblMarkup')}
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
      {saving && <span className="text-xs text-gray-400">{t('estEditor.savingShort')}</span>}
      <p className="ml-4 text-xs text-gray-500">
        {t('estEditor.markupHelp')}
      </p>
    </div>
  );
}

// Per-line markup override input. Renders the placeholder as the
// estimate-level default so the estimator can see "20% (default)"
// when no override is set, and "10% (override)" when it is. Empty
// input clears the override.
function MarkupOverrideField({
  value,
  defaultPct,
  onCommit,
}: {
  value: number | undefined;
  defaultPct: number;
  onCommit: (pct: number | undefined) => void;
}) {
  const [text, setText] = useState(
    value == null ? '' : (value * 100).toFixed(1),
  );
  useEffect(() => {
    setText(value == null ? '' : (value * 100).toFixed(1));
  }, [value]);
  const isOverridden = value != null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="uppercase tracking-wide">Markup</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const trimmed = text.trim();
          if (trimmed === '') {
            if (value != null) onCommit(undefined);
            return;
          }
          const n = Number(trimmed.replace(/[%,\s]/g, ''));
          if (!Number.isFinite(n) || n < 0 || n > 200) {
            setText(value == null ? '' : (value * 100).toFixed(1));
            return;
          }
          const pct = n / 100;
          if (Math.abs(pct - (value ?? -1)) < 0.0001) return;
          onCommit(pct);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={(defaultPct * 100).toFixed(1)}
        title={
          isOverridden
            ? `Override: ${(value * 100).toFixed(1)}% (default ${(defaultPct * 100).toFixed(1)}%)`
            : `Inheriting estimate default ${(defaultPct * 100).toFixed(1)}%`
        }
        className={`w-12 rounded border px-1 py-0.5 text-right font-mono text-[10px] ${
          isOverridden
            ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-800'
            : 'border-gray-200 text-gray-500'
        }`}
      />
      <span>%</span>
    </span>
  );
}

// Bid risk score banner — collapses by default, expands on click.
// Lives near the top of the editor so the estimator can see at a
// glance whether the bid is in shape to drop in the box.
function BidRiskBanner({
  estimate,
  totals,
}: {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}) {
  const [expanded, setExpanded] = useState(false);
  const risk = computeBidRiskScore(estimate, totals);
  const styles =
    risk.level === 'red'
      ? 'border-red-300 bg-red-50 text-red-900'
      : risk.level === 'yellow'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-green-300 bg-green-50 text-green-900';
  const label =
    risk.level === 'red'
      ? 'High risk — likely tossed at bid open'
      : risk.level === 'yellow'
        ? 'Some loose ends — review before submission'
        : 'Looks ready to submit';
  const showFactors = expanded && risk.factors.length > 0;
  return (
    <div className={`rounded-md border px-3 py-2 ${styles}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left text-xs"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold">
            {risk.score}
          </span>
          <span className="text-[10px] uppercase tracking-wide opacity-80">
            risk score
          </span>
          <span className="font-medium">{label}</span>
        </span>
        <span>
          {risk.factors.length === 0
            ? 'No flagged factors'
            : expanded
              ? 'Hide details ▲'
              : `${risk.factors.length} factor${risk.factors.length === 1 ? '' : 's'} ▼`}
        </span>
      </button>
      {showFactors && (
        <ul className="mt-2 space-y-1 border-t border-current/10 pt-2 text-xs">
          {risk.factors.map((f) => (
            <li key={f.id} className="flex items-start gap-2">
              <span className="font-mono text-[10px] opacity-70">
                +{f.contribution}
              </span>
              <span>
                <span className="font-semibold">{f.label}</span>
                <span className="block text-[11px] opacity-80">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

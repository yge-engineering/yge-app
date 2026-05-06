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
import { BidDueCountdown } from './bid-due-countdown';
import { CrossCheckAddendaButton } from './cross-check-addenda-button';

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

  // Keyboard-shortcut help overlay. Pressed `?` (without modifiers)
  // anywhere outside an input field toggles it; lists every Excel-
  // style shortcut the editor supports so estimators don't have to
  // poke around to discover them.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Find/replace toolbar state. When openFindReplace is true, the
  // strip above the grid takes input. Matches are case-insensitive
  // substring matches against item.description.
  const [openFindReplace, setOpenFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const findMatches =
    findText.trim() === ''
      ? []
      : estimate.bidItems
          .map((item, i) => ({ item, i }))
          .filter(({ item }) =>
            item.description.toLowerCase().includes(findText.toLowerCase()),
          );

  async function applyFindReplace() {
    if (findText.trim() === '') return;
    const pattern = findText;
    const replacement = replaceText;
    // Case-insensitive global replace.
    const re = new RegExp(
      pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi',
    );
    for (const { i, item } of findMatches) {
      const next = item.description.replace(re, replacement);
      if (next === item.description) continue;
      // eslint-disable-next-line no-await-in-loop
      await applyItemPatch(i, { description: next });
    }
  }

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

  // Insert a duplicate of `itemIndex` immediately below it. The
  // duplicate clears reviewState so the estimator looks at it
  // fresh, and bumps itemNumber with a -2 / -3 / etc suffix when
  // the existing item ends with a digit, so the bid form numbering
  // doesn't collide. Saves through the bid-items PATCH.
  async function duplicateRow(itemIndex: number) {
    const source = estimate.bidItems[itemIndex];
    if (!source) return;
    const next = [...estimate.bidItems];
    const cloned: PricedEstimate['bidItems'][number] = {
      ...source,
      itemNumber: `${source.itemNumber} (copy)`,
      reviewState: undefined,
    };
    next.splice(itemIndex + 1, 0, cloned);
    setEstimate((e) => ({ ...e, bidItems: next }));
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidItems: next }),
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

  // Remove a row. Schema requires bidItems.length >= 1; bounce when
  // we're at one row (estimator can clear it manually if they want
  // to start over).
  async function deleteRow(itemIndex: number) {
    if (estimate.bidItems.length <= 1) {
      setError('Cannot delete the last row — every estimate needs at least one bid item.');
      return;
    }
    if (
      !window.confirm(
        `Delete bid item ${estimate.bidItems[itemIndex]?.itemNumber ?? '?'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    const next = estimate.bidItems.filter((_, i) => i !== itemIndex);
    setEstimate((e) => ({ ...e, bidItems: next }));
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidItems: next }),
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

  // Generic estimate-level PATCH for fields that don't need their own
  // helper (perUnitPrice, notes, etc.). Mirrors what applyMarkupChange
  // does for markup but takes any subset of the EstimatePatch shape.
  async function applyEstimatePatch(
    patch: Partial<{
      perUnitPrice: PricedEstimate['perUnitPrice'] | null;
      notes: string;
    }>,
  ) {
    const next = {
      ...estimate,
      ...(patch.perUnitPrice !== undefined
        ? { perUnitPrice: patch.perUnitPrice ?? undefined }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || undefined } : {}),
    } as PricedEstimate;
    setEstimate(next);
    recomputeLocal(next);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
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
        <PerUnitPriceCard
          totals={totals}
          perUnit={estimate.perUnitPrice}
          onCommit={(next) =>
            void applyEstimatePatch({ perUnitPrice: next ?? null })
          }
        />
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {t('estEditor.errSave', { error })}
        </div>
      )}

      <BidDueCountdown bidDueDate={estimate.bidDueDate} />
      <div className="flex items-center justify-between">
        <LastSavedPill updatedAt={estimate.updatedAt} />
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard shortcuts (or press ?)"
          className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700"
        >
          ⌨ Shortcuts
        </button>
      </div>
      {shortcutsOpen && (
        <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />
      )}
      <PinnedNotes
        notes={estimate.notes ?? ''}
        onCommit={(next) => void applyEstimatePatch({ notes: next })}
      />
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
            {(showUnreviewedOnly ||
              openFindReplace ||
              selectedIndices.size > 0) && (
              <button
                type="button"
                onClick={() => {
                  setShowUnreviewedOnly(false);
                  setOpenFindReplace(false);
                  setFindText('');
                  setReplaceText('');
                  clearSelection();
                }}
                className="rounded border border-gray-400 bg-white px-2 py-0.5 font-medium text-gray-700 hover:border-gray-600 hover:bg-gray-100"
                title="Clear all filters and selections"
              >
                Reset filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenFindReplace((v) => !v)}
              className={`rounded border px-2 py-0.5 font-medium ${
                openFindReplace
                  ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700'
                  : 'border-gray-300 text-gray-600 hover:border-yge-blue-500 hover:text-yge-blue-700'
              }`}
              title="Find / replace across line descriptions"
            >
              🔍 Find/replace
            </button>
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
        {openFindReplace && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-gray-500">
              Find / replace
            </span>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Find text in descriptions"
              className="w-48 rounded border border-gray-300 px-2 py-1"
              aria-label="Find text"
            />
            <span className="text-gray-500">→</span>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with"
              className="w-48 rounded border border-gray-300 px-2 py-1"
              aria-label="Replace with"
            />
            <span className="text-gray-600">
              {findMatches.length === 0
                ? 'No matches'
                : `${findMatches.length} row${findMatches.length === 1 ? '' : 's'} match`}
            </span>
            <button
              type="button"
              disabled={findMatches.length === 0}
              onClick={() => void applyFindReplace()}
              className="ml-auto rounded bg-yge-blue-500 px-3 py-1 font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Replace in {findMatches.length}
            </button>
            <button
              type="button"
              onClick={() => {
                setFindText('');
                setReplaceText('');
              }}
              className="rounded px-2 py-1 text-gray-600 hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        )}
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
                <th className="w-6 py-2" title="Row status indicator (red = blocker, amber = warning, green = reviewed)" />
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
              {(() => {
                // Walk the visible rows; emit a section header tr
                // whenever the schedule label changes from the
                // previous row. Sentinel "__init__" forces the
                // first header to render. Header is hidden when
                // every row is on the empty/default schedule.
                const visible = estimate.bidItems
                  .map((item, i) => ({ item, i }))
                  .filter(({ item }) => visibleRowFilter(item));
                const haveSchedules = visible.some(
                  ({ item }) => (item.schedule ?? '').trim() !== '',
                );
                let previousSched = '__init__';
                const out: React.ReactNode[] = [];
                for (const { item, i } of visible) {
                  const sched = (item.schedule ?? '').trim();
                  if (haveSchedules && sched !== previousSched) {
                    previousSched = sched;
                    out.push(
                      <tr
                        key={`hdr-${i}`}
                        className="bg-gray-100/80 text-[10px] uppercase tracking-wide text-gray-500"
                      >
                        <td colSpan={8} className="px-3 py-1">
                          {sched === ''
                            ? 'Base bid (no schedule label)'
                            : `Schedule ${sched}`}
                        </td>
                      </tr>,
                    );
                  }
                  out.push(
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
                  onQuantityChange={(qty) =>
                    void applyItemPatch(i, { quantity: qty })
                  }
                  onDescriptionChange={(d) =>
                    void applyItemPatch(i, { description: d })
                  }
                  onDuplicate={() => void duplicateRow(i)}
                  onDelete={() => void deleteRow(i)}
                  defaultMarkupPct={estimate.oppPercent}
                  variance={variance[i]}
                  selected={selectedIndices.has(i)}
                  onToggleSelected={(shift) => toggleRowSelected(i, shift)}
                  apiBaseUrl={apiBaseUrl}
                  estimateId={estimate.id}
                  projectType={estimate.projectType}
                />,
                  );
                }
                return out;
              })()}
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
                          colSpan={7}
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
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500" colSpan={7}>
                  {t('estEditor.totalsDirect')}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatUSD(totals.directCents)}
                </td>
                <td />
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500" colSpan={7}>
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
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-yge-blue-700" colSpan={7}>
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
                    colSpan={7}
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {totals.unpricedLineCount > 0
              ? totals.unpricedLineCount === 1
                ? t('estEditor.unpricedOne')
                : t('estEditor.unpricedMany', { count: totals.unpricedLineCount })
              : t('estEditor.allPriced')}
          </p>
          <button
            type="button"
            onClick={() => {
              // Append a blank row at the bottom of the bid items.
              // Goes through duplicateRow's append path by cloning the
              // last row and clearing the description so the user gets
              // a sensible default unit/quantity to overwrite.
              const lastIdx = estimate.bidItems.length - 1;
              if (lastIdx < 0) return;
              void duplicateRow(lastIdx);
            }}
            className="rounded-md border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-50"
          >
            + Add row at end
          </button>
        </div>
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

      <div className="flex items-center justify-between gap-2">
        <AddendumEditor
          estimate={estimate}
          apiBaseUrl={apiBaseUrl}
          onUpdated={(nextEstimate, nextTotals) => {
            setEstimate(nextEstimate);
            setTotals(nextTotals);
          }}
        />
      </div>
      {estimate.addenda.length > 0 && (
        <div className="flex justify-end">
          <CrossCheckAddendaButton
            apiBaseUrl={apiBaseUrl}
            estimateId={estimate.id}
          />
        </div>
      )}

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
  onQuantityChange,
  onDescriptionChange,
  onDuplicate,
  onDelete,
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
  /** Update the bid item quantity (editable inline + via PDF takeoff). */
  onQuantityChange: (quantity: number) => void;
  /** Update the bid item description (editable inline). */
  onDescriptionChange: (description: string) => void;
  /** Insert a duplicate of this row immediately below it. */
  onDuplicate: () => void;
  /** Delete this row. Bounces if it's the last remaining row. */
  onDelete: () => void;
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

  // Status dot for the inline error rail. One symbol per row so the
  // estimator can scan the left margin and see exactly which lines
  // need attention without reading every column.
  //
  //   🔴 red    — blocker: no unit price.
  //   🟡 yellow — warn: variance flag, LOW conf unreviewed, flagged.
  //   ✓ green   — reviewed/accepted (also covers a clean priced row
  //                 without a review state, which we leave neutral).
  //   ·  gray   — neutral: priced and not flagged, not yet reviewed.
  let statusSymbol = '·';
  let statusClass = 'text-gray-300';
  let statusTitle = 'Priced — review when ready';
  if (item.unitPriceCents == null) {
    statusSymbol = '●';
    statusClass = 'text-red-600';
    statusTitle = 'Blocker — line is unpriced';
  } else if (varianceFlagged) {
    statusSymbol = '●';
    statusClass = 'text-amber-600';
    statusTitle = `Variance — ${(variance!.deviation! * 100).toFixed(0)}% off historical median`;
  } else if (item.reviewState === 'flagged') {
    statusSymbol = '●';
    statusClass = 'text-amber-600';
    statusTitle = 'Flagged — needs another look';
  } else if (item.confidence === 'LOW' && item.reviewState !== 'accepted') {
    statusSymbol = '●';
    statusClass = 'text-amber-600';
    statusTitle = 'LOW confidence — review before submission';
  } else if (item.reviewState === 'accepted') {
    statusSymbol = '✓';
    statusClass = 'text-green-600';
    statusTitle = 'Reviewed';
  }

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
      <td className="w-6 py-2 text-center align-top">
        <span
          className={`text-sm font-bold ${statusClass}`}
          title={statusTitle}
          aria-label={statusTitle}
        >
          {statusSymbol}
        </span>
      </td>
      <td className="px-3 py-2 align-top text-xs text-gray-500">{item.itemNumber}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start justify-between gap-2">
          <DescriptionCell
            value={item.description}
            onCommit={(next) => onDescriptionChange(next)}
          />
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
      <td className="px-3 py-2 text-right align-top">
        <QuantityCell
          value={item.quantity}
          onCommit={(qty) => onQuantityChange(qty)}
        />
        <TakeoffButton
          apiBaseUrl={apiBaseUrl}
          itemDescription={item.description}
          itemUnit={item.unit}
          onApply={(qty) => onQuantityChange(qty)}
        />
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
              onClick={onDuplicate}
              title="Insert a duplicate of this row below"
              aria-label="Duplicate this row"
              className="rounded border border-gray-300 px-1 py-0.5 text-[10px] text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700"
            >
              ⊕
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete this row"
              aria-label="Delete this row"
              className="rounded border border-gray-300 px-1 py-0.5 text-[10px] text-gray-500 hover:border-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
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

// "Last saved" pill — re-ticks every 30 seconds so the estimator
// can confirm the auto-save is alive. Reads estimate.updatedAt
// which gets bumped server-side on every PATCH.
function LastSavedPill({ updatedAt }: { updatedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(handle);
  }, []);
  const ms = Date.now() - Date.parse(updatedAt);
  void now;
  if (!Number.isFinite(ms) || ms < 0) {
    return <span className="text-[10px] text-gray-400">Last saved —</span>;
  }
  const minutes = Math.round(ms / 60_000);
  const label =
    minutes < 1
      ? 'Saved just now'
      : minutes < 60
        ? `Saved ${minutes} min ago`
        : `Saved ${Math.round(minutes / 60)} hr ago`;
  return (
    <span
      className="text-[10px] text-gray-500"
      title={new Date(updatedAt).toLocaleString()}
    >
      ✓ {label}
    </span>
  );
}

// Keyboard-shortcuts help overlay. Click outside or hit ESC / `?`
// to close. Lists every Excel-style shortcut the editor supports
// so estimators coming from a spreadsheet workflow don't have to
// guess.
function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const rows: Array<{ key: string; what: string }> = [
    { key: 'Enter', what: 'Commit cell + jump to next row' },
    { key: 'Shift+Enter', what: 'Commit + jump to previous row' },
    { key: '↓ / ↑', what: 'Move between rows in unit-price column' },
    { key: 'Tab', what: 'Commit + browser default tab nav' },
    { key: '⌘Z / Ctrl+Z', what: 'Undo last cell change (50 deep)' },
    { key: 'Paste', what: 'Splat a column of unit prices from Excel' },
    { key: '?', what: 'Toggle this shortcuts list' },
    { key: '✓ / ⚠ chips', what: 'Mark a line accepted / flagged' },
    { key: '🕐', what: 'See past prices for similar lines' },
    { key: '❓', what: 'AI explain what this line covers' },
    { key: '📊', what: 'Open / edit the crew buildup' },
    { key: '📐', what: 'Drop a plan-set PDF for AI takeoff' },
    { key: '🔍 Find/replace', what: 'Bulk-edit descriptions' },
    { key: 'Bulk select', what: 'Click checkboxes (shift-click for range)' },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-gray-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Estimating editor shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            ✕
          </button>
        </header>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-1.5 font-mono text-gray-800">{r.key}</td>
                <td className="px-3 py-1.5 text-gray-700">{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">
          Press ? or Escape to close.
        </footer>
      </div>
    </div>
  );
}

// Pinned notes — a small note field at the top of the editor that
// stays visible while the estimator works. Maps to estimate.notes
// in the schema; just rendered up here so it isn't buried below
// the bid grid. Auto-saves on blur.
function PinnedNotes({
  notes,
  onCommit,
}: {
  notes: string;
  onCommit: (next: string) => void;
}) {
  const [text, setText] = useState(notes);
  const [expanded, setExpanded] = useState(notes.trim().length > 0);
  useEffect(() => setText(notes), [notes]);
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start rounded border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700"
      >
        📌 Add pinned notes
      </button>
    );
  }
  return (
    <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-amber-800">
        <span>📌 Pinned notes</span>
        {text.trim() === '' && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-amber-700 hover:underline"
          >
            collapse
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text === notes) return;
          onCommit(text.slice(0, 5_000));
        }}
        placeholder="Reminders, gotchas, internal context — visible at the top of the editor and not printed on the bid."
        className="w-full resize-y rounded border border-yellow-200 bg-white px-2 py-1 text-xs"
        rows={2}
        maxLength={5_000}
      />
    </div>
  );
}

// Inline description editor. Click into the text to edit; commit
// on blur. The text was previously read-only — finding/replace
// from bundle 971 had to do all the work, but a one-off rename
// like fixing a typo or adjusting wording for an addendum needs
// per-row edit too.
function DescriptionCell({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <textarea
      value={text}
      rows={Math.min(4, Math.max(1, Math.ceil(text.length / 60)))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text;
        if (trimmed === value) return;
        if (trimmed.length === 0) {
          // Empty descriptions get rejected by the schema; bounce.
          setText(value);
          return;
        }
        onCommit(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          // Enter commits + blurs; Shift+Enter inserts a newline
          // for multi-line descriptions.
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-gray-900 hover:border-gray-200 focus:border-yge-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      aria-label="Bid item description"
      maxLength={500}
    />
  );
}

// Inline quantity editor. Mirrors the unit-price editor pattern:
// commit on blur or Enter, validate non-negative numeric, reset
// to the last good value on bad input.
function QuantityCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(value === 0 ? '' : String(value));
  useEffect(() => {
    setText(value === 0 ? '' : String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim();
        if (trimmed === '') {
          if (value !== 0) onCommit(0);
          return;
        }
        const n = Number(trimmed.replace(/[,\s]/g, ''));
        if (!Number.isFinite(n) || n < 0) {
          setText(value === 0 ? '' : String(value));
          return;
        }
        const rounded = Math.round(n * 1000) / 1000;
        if (rounded === value) return;
        onCommit(rounded);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="0"
      aria-label="Bid item quantity"
      className="w-24 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
    />
  );
}

// 📐 Takeoff button. Pops a file picker; upload a plan-set PDF and
// the API runs Anthropic with a prompt scoped to THIS row's
// description + unit. Returns a numeric quantity (best effort) +
// reasoning. Estimator confirms before applying so a wild guess
// doesn't clobber a hand-typed quantity.
function TakeoffButton({
  apiBaseUrl,
  itemDescription,
  itemUnit,
  onApply,
}: {
  apiBaseUrl: string;
  itemDescription: string;
  itemUnit: string;
  onApply: (qty: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <label
      className={`mt-1 inline-flex cursor-pointer items-center gap-1 rounded border px-1 py-0.5 text-[10px] ${
        busy
          ? 'cursor-wait border-gray-300 text-gray-500'
          : 'border-gray-300 text-gray-500 hover:border-yge-blue-500 hover:text-yge-blue-700'
      }`}
      title="Pick a plan-set PDF and the AI will pull this line's takeoff out"
    >
      <span aria-hidden>📐</span>
      <span>{busy ? 'Reading…' : 'Takeoff'}</span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const form = new FormData();
            form.append('file', file);
            form.append('description', itemDescription);
            form.append('unit', itemUnit);
            const res = await fetch(`${apiBaseUrl}/api/takeoff/extract`, {
              method: 'POST',
              body: form,
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            const json = (await res.json()) as {
              quantity: number | null;
              reasoning?: string;
              pageRef?: string;
            };
            if (json.quantity == null) {
              throw new Error('AI could not find this scope in the PDF.');
            }
            const ok = window.confirm(
              `AI suggests ${json.quantity.toLocaleString()} ${itemUnit}` +
                (json.pageRef ? ` (${json.pageRef})` : '') +
                (json.reasoning ? `\n\n${json.reasoning}` : '') +
                '\n\nApply this quantity?',
            );
            if (ok) onApply(json.quantity);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Takeoff failed');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      {error && <span className="ml-1 text-red-700">⚠</span>}
    </label>
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

// Per-unit price pane. Sits next to the totals card and shows
// "Per <unit>: $X.XX" computed live as bidTotalCents / sizeValue.
// Used most often on fuel-reduction or grading bids where the
// agency expects a per-acre price alongside the lump sum, but
// works for any size unit (mile, SF, LF, ton, custom). Estimator
// types the size + the unit; everything else is computed.
function PerUnitPriceCard({
  totals,
  perUnit,
  onCommit,
}: {
  totals: PricedEstimateTotals;
  perUnit: { unit: string; value: number } | undefined;
  onCommit: (next: { unit: string; value: number } | undefined) => void;
}) {
  const [unit, setUnit] = useState(perUnit?.unit ?? 'acre');
  const [valueText, setValueText] = useState(
    perUnit?.value && perUnit.value > 0 ? String(perUnit.value) : '',
  );
  useEffect(() => {
    setUnit(perUnit?.unit ?? 'acre');
    setValueText(
      perUnit?.value && perUnit.value > 0 ? String(perUnit.value) : '',
    );
  }, [perUnit]);

  const sizeValue = Number((valueText ?? '').replace(/[,\s]/g, ''));
  const valid = Number.isFinite(sizeValue) && sizeValue > 0;
  const perUnitCents = valid ? Math.round(totals.bidTotalCents / sizeValue) : null;

  function commit() {
    if (!valid) {
      // Empty / invalid → clear the field at the estimate level.
      if (perUnit !== undefined) onCommit(undefined);
      return;
    }
    const trimmedUnit = unit.trim() || 'unit';
    if (
      perUnit?.unit === trimmedUnit &&
      Math.abs((perUnit.value ?? 0) - sizeValue) < 0.0001
    ) {
      return;
    }
    onCommit({ unit: trimmedUnit, value: sizeValue });
  }

  return (
    <div className="rounded-lg border border-yge-blue-500 bg-white p-4 text-right shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        Per-unit price (e.g. per-acre)
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-end gap-1 text-xs">
        <span className="text-gray-700">Size:</span>
        <input
          type="text"
          inputMode="decimal"
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="0"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-right font-mono"
          aria-label="Per-unit size value"
        />
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onBlur={commit}
          placeholder="acre"
          className="w-16 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
          aria-label="Per-unit label"
          maxLength={40}
        />
      </div>
      <div className="mt-2 font-mono text-lg font-semibold text-yge-blue-700">
        {perUnitCents == null
          ? '—'
          : `${formatUSD(perUnitCents)} / ${unit.trim() || 'unit'}`}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        Bid total ÷ size · live
      </div>
    </div>
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

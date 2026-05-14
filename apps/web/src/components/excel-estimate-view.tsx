// In-app editor for Excel-imported estimates.
//
// Read-only by default. Toggle "Edit" to make description / quantity /
// unit / OT / unit cost / notes editable inline. Totals recompute
// live as the user types. Save commits the changes via PATCH; the
// server recomputes totals authoritatively (client recompute is just
// for display).

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';
import { CostCodePicker } from './cost-code-picker';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CostLine {
  category: string | null;
  costCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  otMult: number;
  unitCostCents: number;
  totalCostCents: number;
  oppMarkupCents: number;
  bidPriceCents: number;
  notes: string | null;
}

interface BidItem {
  itemNumber: string;
  description: string;
  costLines: CostLine[];
  subtotalDirectCents: number;
  subtotalOppCents: number;
  subtotalBidCents: number;
}

interface ExcelEstimateData {
  jobNumber?: string;
  projectName?: string;
  rateType?: string;
  oppPercent?: number;
  directCostCents?: number;
  oppMarkupCents?: number;
  bidPriceCents?: number;
  bidItems?: BidItem[];
}

interface Response {
  id: string;
  jobId: string;
  job: { id: string; jobNumber: string; name: string };
  updatedAt: string;
  data: ExcelEstimateData;
}

const CATEGORY_COLORS: Record<string, string> = {
  Labor: 'bg-blue-50 text-blue-900',
  'Equipment (Owned)': 'bg-amber-50 text-amber-900',
  'Equipment (Rental)': 'bg-orange-50 text-orange-900',
  Material: 'bg-green-50 text-green-900',
  Subcontract: 'bg-purple-50 text-purple-900',
  Other: 'bg-gray-100 text-gray-900',
};

function recompute(bidItems: BidItem[], oppPct: number): {
  bidItems: BidItem[];
  direct: number;
  opp: number;
  bid: number;
} {
  let direct = 0;
  let opp = 0;
  let bid = 0;
  const updated = bidItems.map((bi) => {
    let bdDirect = 0;
    let bdOpp = 0;
    let bdBid = 0;
    const lines = bi.costLines.map((line) => {
      const total = Math.round(line.quantity * line.otMult * line.unitCostCents);
      const markup = Math.round(total * oppPct);
      const bidPrice = total + markup;
      bdDirect += total;
      bdOpp += markup;
      bdBid += bidPrice;
      return {
        ...line,
        totalCostCents: total,
        oppMarkupCents: markup,
        bidPriceCents: bidPrice,
      };
    });
    direct += bdDirect;
    opp += bdOpp;
    bid += bdBid;
    return {
      ...bi,
      costLines: lines,
      subtotalDirectCents: bdDirect,
      subtotalOppCents: bdOpp,
      subtotalBidCents: bdBid,
    };
  });
  return { bidItems: updated, direct, opp, bid };
}

export function ExcelEstimateView({ estimateId }: { estimateId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<Response | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ExcelEstimateData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBaseUrl()}/api/estimates/${estimateId}/excel-data`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (res.status === 404) {
          setResp(null);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Load failed (${res.status})`);
          return;
        }
        const body = (await res.json()) as Response;
        setResp(body);
        const init: Record<string, boolean> = {};
        for (const bi of body.data.bidItems ?? []) init[bi.itemNumber] = true;
        setExpanded(init);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [estimateId]);

  if (loading) return <p className="text-sm text-gray-600">Loading estimate…</p>;
  if (error)
    return (
      <p className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
        {error}
      </p>
    );
  if (!resp) return null;

  const view = editMode && draft ? draft : resp.data;
  const oppPct = view.oppPercent ?? 0.2;
  const bidItems = view.bidItems ?? [];

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function enterEdit() {
    setDraft(JSON.parse(JSON.stringify(resp!.data)) as ExcelEstimateData);
    setEditMode(true);
    setSaveMsg(null);
  }

  function discardEdit() {
    setDraft(null);
    setEditMode(false);
    setSaveMsg(null);
  }

  function updateLine(biIdx: number, lineIdx: number, patch: Partial<CostLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).map((bi, i) =>
        i !== biIdx
          ? bi
          : {
              ...bi,
              costLines: bi.costLines.map((line, j) =>
                j !== lineIdx ? line : { ...line, ...patch },
              ),
            },
      );
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return {
        ...prev,
        bidItems: rec,
        directCostCents: direct,
        oppMarkupCents: opp,
        bidPriceCents: bid,
      };
    });
  }

  function updateBidItemDescription(biIdx: number, newDesc: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).map((bi, i) =>
        i !== biIdx ? bi : { ...bi, description: newDesc },
      );
      return { ...prev, bidItems: items };
    });
  }

  function blankCostLine(): CostLine {
    return {
      category: 'Other',
      costCode: null,
      description: '',
      quantity: 1,
      unit: 'LS',
      otMult: 1,
      unitCostCents: 0,
      totalCostCents: 0,
      oppMarkupCents: 0,
      bidPriceCents: 0,
      notes: null,
    };
  }

  function addCostLine(biIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).map((bi, i) =>
        i !== biIdx ? bi : { ...bi, costLines: [...bi.costLines, blankCostLine()] },
      );
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return { ...prev, bidItems: rec, directCostCents: direct, oppMarkupCents: opp, bidPriceCents: bid };
    });
  }

  function moveLine(biIdx: number, lineIdx: number, dir: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).map((bi, i) => {
        if (i !== biIdx) return bi;
        const next = [...bi.costLines];
        const target = lineIdx + dir;
        if (target < 0 || target >= next.length) return bi;
        const tmp = next[lineIdx]!;
        next[lineIdx] = next[target]!;
        next[target] = tmp;
        return { ...bi, costLines: next };
      });
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return { ...prev, bidItems: rec, directCostCents: direct, oppMarkupCents: opp, bidPriceCents: bid };
    });
  }

  function moveBidItem(biIdx: number, dir: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.bidItems ?? [])];
      const target = biIdx + dir;
      if (target < 0 || target >= items.length) return prev;
      const tmp = items[biIdx]!;
      items[biIdx] = items[target]!;
      items[target] = tmp;
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return { ...prev, bidItems: rec, directCostCents: direct, oppMarkupCents: opp, bidPriceCents: bid };
    });
  }

  function deleteCostLine(biIdx: number, lineIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).map((bi, i) =>
        i !== biIdx
          ? bi
          : { ...bi, costLines: bi.costLines.filter((_, j) => j !== lineIdx) },
      );
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return { ...prev, bidItems: rec, directCostCents: direct, oppMarkupCents: opp, bidPriceCents: bid };
    });
  }

  function addBidItem() {
    setDraft((prev) => {
      if (!prev) return prev;
      const existing = prev.bidItems ?? [];
      const nextNum = String(existing.length + 1);
      const newItem: BidItem = {
        itemNumber: nextNum,
        description: 'New bid item',
        costLines: [],
        subtotalDirectCents: 0,
        subtotalOppCents: 0,
        subtotalBidCents: 0,
      };
      const items = [...existing, newItem];
      // Auto-expand the new section so the user sees it.
      setExpanded((e) => ({ ...e, [nextNum]: true }));
      return { ...prev, bidItems: items };
    });
  }

  function deleteBidItem(biIdx: number) {
    if (!confirm('Delete this bid item and all its cost lines?')) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const items = (prev.bidItems ?? []).filter((_, i) => i !== biIdx);
      const { bidItems: rec, direct, opp, bid } = recompute(items, prev.oppPercent ?? 0.2);
      return { ...prev, bidItems: rec, directCostCents: direct, oppMarkupCents: opp, bidPriceCents: bid };
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/estimates/${estimateId}/excel-data`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobNumber: draft.jobNumber,
            projectName: draft.projectName,
            rateType: draft.rateType,
            oppPercent: draft.oppPercent,
            bidItems: draft.bidItems ?? [],
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveMsg(`⚠ ${body.error ?? `Save failed (${res.status})`}`);
        return;
      }
      const body = (await res.json()) as { bidPriceCents: number };
      setResp((prev) =>
        prev ? { ...prev, data: { ...draft, bidPriceCents: body.bidPriceCents } } : prev,
      );
      setSaveMsg('✓ Saved. Live Sync will mark "app-newer" — push to Excel when ready.');
      setEditMode(false);
      setDraft(null);
    } catch (err) {
      setSaveMsg(`⚠ ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Mode toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!editMode ? (
          <button
            type="button"
            onClick={enterEdit}
            className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100"
          >
            ✎ Edit
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : '💾 Save changes'}
            </button>
            <button
              type="button"
              onClick={discardEdit}
              disabled={saving}
              className="rounded-md border border-gray-400 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Discard
            </button>
            <span className="text-xs text-gray-600">
              Editing — changes recompute totals live; click Save to commit.
            </span>
          </>
        )}
        {saveMsg ? (
          <span className="text-xs text-green-700">{saveMsg}</span>
        ) : null}
      </div>

      {/* Header summary */}
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Job</div>
          <div className="mt-1 font-mono text-base font-semibold text-yge-blue-900">
            {view.jobNumber ?? resp.job.jobNumber}
          </div>
          <div className="text-[11px] text-gray-700">
            {view.projectName ?? resp.job.name}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Rate · O&amp;P
          </div>
          <div className="mt-1 text-base font-semibold text-yge-blue-900">
            {view.rateType ?? '—'} · {(oppPct * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Direct cost
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-yge-blue-900">
            <Money cents={view.directCostCents ?? 0} />
          </div>
        </div>
        <div className="rounded-md border border-green-300 bg-green-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-green-800">
            Bid price
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-green-900">
            <Money cents={view.bidPriceCents ?? 0} />
          </div>
          <div className="text-[10px] text-green-700">
            O&amp;P markup <Money cents={view.oppMarkupCents ?? 0} />
          </div>
        </div>
      </section>

      {bidItems.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          No bid items found in this estimate.
        </p>
      ) : (
        <div className="space-y-3">
          {bidItems.map((bi, biIdx) => {
            const isOpen = expanded[bi.itemNumber] ?? true;
            return (
              <section
                key={bi.itemNumber}
                className="overflow-hidden rounded-md border border-gray-200 bg-white"
              >
                <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 bg-yge-blue-50 px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(bi.itemNumber)}
                      className="text-xs text-yge-blue-700"
                    >
                      {isOpen ? '▼' : '▶'}
                    </button>
                    {editMode ? (
                      <input
                        value={bi.description}
                        onChange={(e) =>
                          updateBidItemDescription(biIdx, e.target.value)
                        }
                        className="w-full max-w-2xl rounded border border-yge-blue-300 bg-white px-2 py-1 text-sm font-semibold text-yge-blue-900"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-yge-blue-900">
                        Bid Item {bi.itemNumber} — {bi.description}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-2 text-xs text-yge-blue-800">
                    <span>
                      {bi.costLines.length} line
                      {bi.costLines.length === 1 ? '' : 's'} · subtotal{' '}
                      <span className="font-mono font-semibold">
                        <Money cents={bi.subtotalBidCents} />
                      </span>
                    </span>
                    {editMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => moveBidItem(biIdx, -1)}
                          disabled={biIdx === 0}
                          className="rounded border border-yge-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-40"
                          title="Move bid item up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBidItem(biIdx, 1)}
                          disabled={biIdx === bidItems.length - 1}
                          className="rounded border border-yge-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-40"
                          title="Move bid item down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBidItem(biIdx)}
                          className="rounded border border-red-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                          title="Delete this bid item and all its cost lines"
                        >
                          🗑 Delete item
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
                {isOpen ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
                        <tr>
                          <th className="px-2 py-1">Category</th>
                          <th className="px-2 py-1">Code</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1 text-right">Qty</th>
                          <th className="px-2 py-1">Unit</th>
                          <th className="px-2 py-1 text-right">OT</th>
                          <th className="px-2 py-1 text-right">Unit cost</th>
                          <th className="px-2 py-1 text-right">Total cost</th>
                          <th className="px-2 py-1 text-right">Markup</th>
                          <th className="px-2 py-1 text-right">Bid price</th>
                          <th className="px-2 py-1">Notes</th>
                          {editMode ? <th className="px-2 py-1" /> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bi.costLines.map((line, i) => {
                          const catColor =
                            CATEGORY_COLORS[line.category ?? ''] ?? 'bg-gray-50 text-gray-800';
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-2 py-1">
                                {line.category ? (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${catColor}`}
                                  >
                                    {line.category}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-2 py-1 font-mono text-[11px] text-gray-700">
                                {editMode ? (
                                  <CostCodePicker
                                    value={line.costCode}
                                    rateType={view.rateType ?? 'PW'}
                                    onPick={(r) =>
                                      r.found
                                        ? updateLine(biIdx, i, {
                                            costCode: r.code,
                                            category: r.category ?? line.category,
                                            description: line.description || r.name,
                                            unit: line.unit || r.unit,
                                            unitCostCents:
                                              line.unitCostCents > 0
                                                ? line.unitCostCents
                                                : r.unitCostCents,
                                          })
                                        : updateLine(biIdx, i, { costCode: r.code })
                                    }
                                  />
                                ) : (
                                  line.costCode ?? ''
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {editMode ? (
                                  <input
                                    value={line.description}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, { description: e.target.value })
                                    }
                                    className="w-full rounded border border-gray-200 bg-white px-1 py-0.5 text-sm"
                                  />
                                ) : (
                                  line.description
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-mono">
                                {editMode ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={line.quantity}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, {
                                        quantity: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-20 rounded border border-gray-200 bg-white px-1 py-0.5 text-right font-mono text-sm"
                                  />
                                ) : (
                                  line.quantity
                                )}
                              </td>
                              <td className="px-2 py-1 text-[11px] text-gray-700">
                                {editMode ? (
                                  <input
                                    value={line.unit}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, { unit: e.target.value })
                                    }
                                    className="w-16 rounded border border-gray-200 bg-white px-1 py-0.5 text-sm"
                                  />
                                ) : (
                                  line.unit
                                )}
                              </td>
                              <td className="px-2 py-1 text-right text-[11px] text-gray-600">
                                {editMode ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={line.otMult}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, {
                                        otMult: Number(e.target.value) || 1,
                                      })
                                    }
                                    className="w-14 rounded border border-gray-200 bg-white px-1 py-0.5 text-right text-sm"
                                  />
                                ) : line.otMult !== 1 ? (
                                  `×${line.otMult}`
                                ) : (
                                  ''
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-mono">
                                {editMode ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={(line.unitCostCents / 100).toFixed(2)}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, {
                                        unitCostCents: Math.round(
                                          (Number(e.target.value) || 0) * 100,
                                        ),
                                      })
                                    }
                                    className="w-24 rounded border border-gray-200 bg-white px-1 py-0.5 text-right font-mono text-sm"
                                  />
                                ) : (
                                  <Money cents={line.unitCostCents} />
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-mono font-semibold">
                                <Money cents={line.totalCostCents} />
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-amber-700">
                                <Money cents={line.oppMarkupCents} />
                              </td>
                              <td className="px-2 py-1 text-right font-mono font-semibold text-green-700">
                                <Money cents={line.bidPriceCents} />
                              </td>
                              <td className="px-2 py-1 text-[11px] text-gray-600">
                                {editMode ? (
                                  <input
                                    value={line.notes ?? ''}
                                    onChange={(e) =>
                                      updateLine(biIdx, i, { notes: e.target.value })
                                    }
                                    className="w-48 rounded border border-gray-200 bg-white px-1 py-0.5 text-xs"
                                  />
                                ) : (
                                  line.notes ?? ''
                                )}
                              </td>
                              {editMode ? (
                                <td className="px-2 py-1 text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moveLine(biIdx, i, -1)}
                                      disabled={i === 0}
                                      className="rounded border border-yge-blue-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-40"
                                      title="Move up"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveLine(biIdx, i, 1)}
                                      disabled={i === bi.costLines.length - 1}
                                      className="rounded border border-yge-blue-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-40"
                                      title="Move down"
                                    >
                                      ▼
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteCostLine(biIdx, i)}
                                      className="rounded border border-red-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                                      title="Delete this cost line"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                        {editMode ? (
                          <tr>
                            <td colSpan={12} className="px-2 py-1">
                              <button
                                type="button"
                                onClick={() => addCostLine(biIdx)}
                                className="rounded-md border border-yge-blue-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
                              >
                                + Add cost line
                              </button>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={7} className="px-2 py-1 text-right text-xs text-gray-700">
                            Subtotal — Bid Item {bi.itemNumber}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">
                            <Money cents={bi.subtotalDirectCents} />
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-amber-700">
                            <Money cents={bi.subtotalOppCents} />
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-green-700">
                            <Money cents={bi.subtotalBidCents} />
                          </td>
                          <td />
                          {editMode ? <td /> : null}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </section>
            );
          })}
          {editMode ? (
            <button
              type="button"
              onClick={addBidItem}
              className="w-full rounded-md border-2 border-dashed border-yge-blue-300 bg-white px-3 py-3 text-sm font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
            >
              + Add bid item
            </button>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-500">
        Inline editing: description, qty, unit, OT mult, unit cost, notes.
        Add cost lines per section; add/delete bid items at any level.
        All totals recompute live; click Save to commit.
      </p>
    </div>
  );
}

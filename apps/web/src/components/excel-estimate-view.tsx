// In-app viewer for Excel-imported estimates.
//
// Renders the bid-item + cost-line layout from estimate.data.
// Read-only in this bundle; editing comes next.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

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

export function ExcelEstimateView({ estimateId }: { estimateId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<Response | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBaseUrl()}/api/estimates/${estimateId}/excel-data`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (res.status === 404) {
          // Not an Excel-imported estimate; render nothing (the parent
          // page falls back to the native editor).
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
        // All sections collapsed by default? No — expand all for now.
        const init: Record<string, boolean> = {};
        for (const bi of body.data.bidItems ?? []) init[bi.itemNumber] = true;
        setExpanded(init);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [estimateId]);

  if (loading) {
    return <p className="text-sm text-gray-600">Loading estimate…</p>;
  }
  if (error) {
    return (
      <p className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
        {error}
      </p>
    );
  }
  if (!resp) {
    // Not Excel-imported. Parent renders something else.
    return null;
  }

  const d = resp.data;
  const bidItems = d.bidItems ?? [];

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      {/* Estimate header summary */}
      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Job
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-yge-blue-900">
            {d.jobNumber ?? resp.job.jobNumber}
          </div>
          <div className="text-[11px] text-gray-700">
            {d.projectName ?? resp.job.name}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Rate · O&amp;P
          </div>
          <div className="mt-1 text-base font-semibold text-yge-blue-900">
            {d.rateType ?? '—'} · {((d.oppPercent ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Direct cost
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-yge-blue-900">
            <Money cents={d.directCostCents ?? 0} />
          </div>
        </div>
        <div className="rounded-md border border-green-300 bg-green-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-green-800">
            Bid price
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-green-900">
            <Money cents={d.bidPriceCents ?? 0} />
          </div>
          <div className="text-[10px] text-green-700">
            O&amp;P markup <Money cents={d.oppMarkupCents ?? 0} />
          </div>
        </div>
      </section>

      {bidItems.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          No bid items found in this estimate.
        </p>
      ) : (
        <div className="space-y-3">
          {bidItems.map((bi) => {
            const isOpen = expanded[bi.itemNumber] ?? true;
            return (
              <section
                key={bi.itemNumber}
                className="overflow-hidden rounded-md border border-gray-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggle(bi.itemNumber)}
                  className="flex w-full items-baseline justify-between gap-3 border-b border-gray-100 bg-yge-blue-50 px-3 py-2 text-left hover:bg-yge-blue-100"
                >
                  <span className="text-sm font-semibold text-yge-blue-900">
                    Bid Item {bi.itemNumber} — {bi.description}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-yge-blue-800">
                    {bi.costLines.length} line{bi.costLines.length === 1 ? '' : 's'} · subtotal{' '}
                    <span className="font-mono font-semibold">
                      <Money cents={bi.subtotalBidCents} />
                    </span>
                    <span className="text-yge-blue-700">{isOpen ? '▼' : '▶'}</span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
                        <tr>
                          <th className="px-2 py-1">Category</th>
                          <th className="px-2 py-1">Cost code</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1 text-right">Qty</th>
                          <th className="px-2 py-1">Unit</th>
                          <th className="px-2 py-1 text-right">OT</th>
                          <th className="px-2 py-1 text-right">Unit cost</th>
                          <th className="px-2 py-1 text-right">Total cost</th>
                          <th className="px-2 py-1 text-right">Markup</th>
                          <th className="px-2 py-1 text-right">Bid price</th>
                          <th className="px-2 py-1">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bi.costLines.map((line, i) => {
                          const catColor =
                            CATEGORY_COLORS[line.category ?? ''] ??
                            'bg-gray-50 text-gray-800';
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
                                {line.costCode ?? ''}
                              </td>
                              <td className="px-2 py-1">{line.description}</td>
                              <td className="px-2 py-1 text-right font-mono">
                                {line.quantity}
                              </td>
                              <td className="px-2 py-1 text-[11px] text-gray-700">
                                {line.unit}
                              </td>
                              <td className="px-2 py-1 text-right text-[11px] text-gray-600">
                                {line.otMult !== 1 ? `×${line.otMult}` : ''}
                              </td>
                              <td className="px-2 py-1 text-right font-mono">
                                <Money cents={line.unitCostCents} />
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
                                {line.notes ?? ''}
                              </td>
                            </tr>
                          );
                        })}
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
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-500">
        Read-only view. Inline editing ships in the next bundle. Use the
        Excel buttons above to push/pull the workbook for now.
      </p>
    </div>
  );
}

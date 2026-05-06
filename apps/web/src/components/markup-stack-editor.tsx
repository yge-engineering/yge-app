'use client';

// Markup stack editor.
//
// Heavy-civil bids stack costs in layers — labor burden (workers
// comp + payroll taxes + GL), equipment burden (fuel + maintenance),
// sub markup, bonds, insurance, contingency, then the lump O&P.
// One number isn't enough; the bond agent and the office both want
// to see each line. This editor surfaces all six sub-percents
// alongside the existing O&P field, with live cents next to each.
//
// Saves through the estimate-level PATCH (the parent owns the wire
// call). Inline-edit pattern: text input, blur to commit.

import { useEffect, useState } from 'react';
import {
  formatUSD,
  type MarkupStackBreakdown,
  type PricedEstimate,
} from '@yge/shared';

type MarkupKey =
  | 'laborBurdenPct'
  | 'equipmentBurdenPct'
  | 'subMarkupPct'
  | 'bondPct'
  | 'insurancePct'
  | 'contingencyPct';

interface Row {
  key: MarkupKey;
  label: string;
  hint: string;
  /** Max value sanity-checked against the schema (decimal fraction). */
  max: number;
}

const ROWS: Row[] = [
  {
    key: 'laborBurdenPct',
    label: 'Labor burden',
    hint: 'Workers comp + payroll taxes + GL on labor (typ. 30–50%)',
    max: 2,
  },
  {
    key: 'equipmentBurdenPct',
    label: 'Equipment burden',
    hint: 'Fuel + maintenance + ownership cost (typ. 10–25%)',
    max: 2,
  },
  {
    key: 'subMarkupPct',
    label: 'Sub markup',
    hint: 'Mark-up on subcontractor totals (typ. 5–10%)',
    max: 2,
  },
  {
    key: 'bondPct',
    label: 'Bonds',
    hint: 'Bid bond + payment/performance bond (typ. 1.5–3%)',
    max: 0.2,
  },
  {
    key: 'insurancePct',
    label: 'Insurance',
    hint: "Builder's risk + general policy (typ. 0.5–1.5%)",
    max: 0.2,
  },
  {
    key: 'contingencyPct',
    label: 'Contingency',
    hint: "Estimator's safety margin (typ. 0–5%)",
    max: 0.5,
  },
];

interface Props {
  markup: NonNullable<PricedEstimate['markup']> | undefined;
  breakdown: MarkupStackBreakdown;
  saving?: boolean;
  onCommit: (key: MarkupKey, decimal: number) => void;
}

export function MarkupStackEditor({ markup, breakdown, saving, onCommit }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Markup stack
        </h2>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </header>
      <p className="mb-3 text-xs text-gray-600">
        Each layer is a flat percent on direct cost. Leave at 0 to skip
        a layer — they all roll up into the bid total alongside O&P.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-1 py-1 text-left">Layer</th>
            <th className="px-1 py-1 text-right">Percent</th>
            <th className="px-1 py-1 text-right">Cents on direct</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ROWS.map((row) => {
            const value = (markup?.[row.key] ?? 0) as number;
            const cents =
              row.key === 'laborBurdenPct'
                ? breakdown.laborBurdenCents
                : row.key === 'equipmentBurdenPct'
                  ? breakdown.equipmentBurdenCents
                  : row.key === 'subMarkupPct'
                    ? breakdown.subMarkupCents
                    : row.key === 'bondPct'
                      ? breakdown.bondCents
                      : row.key === 'insurancePct'
                        ? breakdown.insuranceCents
                        : breakdown.contingencyCents;
            return (
              <tr key={row.key}>
                <td className="px-1 py-1.5">
                  <div className="font-medium text-gray-800">{row.label}</div>
                  <div className="text-[10px] text-gray-500">{row.hint}</div>
                </td>
                <td className="px-1 py-1.5 text-right">
                  <PercentInput
                    value={value}
                    max={row.max}
                    onCommit={(v) => onCommit(row.key, v)}
                  />
                </td>
                <td className="px-1 py-1.5 text-right font-mono text-xs">
                  {formatUSD(cents)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-300">
            <td className="px-1 py-1.5 text-xs uppercase tracking-wide text-gray-500">
              O&P (set above)
            </td>
            <td className="px-1 py-1.5 text-right text-xs text-gray-500">
              —
            </td>
            <td className="px-1 py-1.5 text-right font-mono text-xs">
              {formatUSD(breakdown.oppCents)}
            </td>
          </tr>
          <tr>
            <td className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-yge-blue-700" colSpan={2}>
              Total markup
            </td>
            <td className="px-1 py-2 text-right font-mono text-sm font-semibold text-yge-blue-700">
              {formatUSD(
                breakdown.laborBurdenCents +
                  breakdown.equipmentBurdenCents +
                  breakdown.subMarkupCents +
                  breakdown.bondCents +
                  breakdown.insuranceCents +
                  breakdown.contingencyCents +
                  breakdown.oppCents,
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function PercentInput({
  value,
  max,
  onCommit,
}: {
  value: number;
  max: number;
  onCommit: (decimal: number) => void;
}) {
  const [text, setText] = useState((value * 100).toFixed(1));
  useEffect(() => {
    setText((value * 100).toFixed(1));
  }, [value]);
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(/[%,\s]/g, ''));
          const clamped = Math.max(0, Math.min(max * 100, n));
          if (!Number.isFinite(n) || n < 0) {
            setText((value * 100).toFixed(1));
            return;
          }
          const dec = clamped / 100;
          if (Math.abs(dec - value) < 0.0001) return;
          onCommit(dec);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-16 rounded border border-gray-300 px-1 py-0.5 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      />
      <span className="text-xs text-gray-500">%</span>
    </div>
  );
}

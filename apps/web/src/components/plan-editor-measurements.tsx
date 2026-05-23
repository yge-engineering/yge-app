'use client';

// MeasurementsPanel — list of measurements for the current sheet with inline
// label editing and per-row delete. Used inside PlanEditor.

import { useState } from 'react';
import {
  defaultMeasurementColor,
  measurementValue,
  takeoffMeasurementKindLabel,
  type PlanScale,
  type PlanSheetTakeoff,
  type PlanTakeoff,
  type TakeoffMeasurement,
} from '@yge/shared';

interface Props {
  measurements: TakeoffMeasurement[];
  scale: PlanScale | undefined;
  saving: boolean;
  saveError: string | null;
  /** Apply an updater to the current sheet and PATCH. */
  onPatchSheet: (
    updater: (sheet: PlanSheetTakeoff) => PlanSheetTakeoff,
  ) => Promise<PlanTakeoff | null>;
}

export function MeasurementsPanel({
  measurements,
  scale,
  saving,
  saveError,
  onPatchSheet,
}: Props) {
  // Defer label edits until blur so we don't PATCH on every keystroke.
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  async function commitLabel(id: string, label: string) {
    const trimmed = label.trim();
    await onPatchSheet((sheet) => ({
      ...sheet,
      measurements: sheet.measurements.map((m) =>
        m.id === id ? { ...m, label: trimmed === '' ? undefined : trimmed } : m,
      ),
    }));
    setLabelDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  async function remove(id: string) {
    if (!confirm('Delete this measurement?')) return;
    await onPatchSheet((sheet) => ({
      ...sheet,
      measurements: sheet.measurements.filter((m) => m.id !== id),
    }));
  }

  if (measurements.length === 0) {
    return null;
  }

  return (
    <details className="border-b border-gray-200 bg-white" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50">
        Measurements ({measurements.length})
        {saving ? <span className="ml-2 text-blue-700">saving…</span> : null}
        {saveError ? <span className="ml-2 text-red-700">{saveError}</span> : null}
      </summary>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-semibold">Kind</th>
              <th className="px-3 py-1.5 text-left font-semibold">Label</th>
              <th className="px-3 py-1.5 text-right font-semibold">Value</th>
              <th className="px-3 py-1.5 text-left font-semibold">Bid item</th>
              <th className="px-3 py-1.5 text-right font-semibold">Points</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {measurements.map((m) => {
              const v = measurementValue(m, scale);
              const color = m.color ?? defaultMeasurementColor(m.kind);
              const draft = labelDrafts[m.id];
              const current = draft ?? m.label ?? '';
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-1">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase"
                      style={{ color }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      {takeoffMeasurementKindLabel(m.kind)}
                    </span>
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={current}
                      placeholder="—"
                      onChange={(e) =>
                        setLabelDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (draft !== undefined && draft !== (m.label ?? '')) {
                          void commitLabel(m.id, draft);
                        }
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-sm">
                    {v.value.toFixed(v.unit === 'EA' ? 0 : 2)}{' '}
                    <span className="text-xs text-gray-500">{v.unit}</span>
                  </td>
                  <td className="px-3 py-1">
                    <span className="font-mono text-xs text-gray-600">
                      {m.bidItemId ?? <em className="text-gray-400">—</em>}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-right text-xs text-gray-500">
                    {m.points.length}
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(m.id)}
                      title="Delete measurement"
                      className="rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

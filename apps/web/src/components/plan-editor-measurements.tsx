'use client';

import { useState } from 'react';
import {
  defaultMeasurementColor,
  measurementValue,
  takeoffMeasurementKindLabel,
  type PlanScale,
  type PlanSheetTakeoff,
  type PlanTakeoff,
  type PlanUnit,
  type TakeoffMeasurement,
} from '@yge/shared';

interface Props {
  measurements: TakeoffMeasurement[];
  scale: PlanScale | undefined;
  saving: boolean;
  saveError: string | null;
  hiddenLayers: Set<string>;
  onToggleLayer: (layer: string) => void;
  onPatchSheet: (
    updater: (sheet: PlanSheetTakeoff) => PlanSheetTakeoff,
  ) => Promise<PlanTakeoff | null>;
}

interface UnitTotal {
  value: number;
  count: number;
}

const UNASSIGNED = '__unassigned__';
const NO_LAYER = '__nolayer__';

export function MeasurementsPanel({
  measurements,
  scale,
  saving,
  saveError,
  hiddenLayers,
  onToggleLayer,
  onPatchSheet,
}: Props) {
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [bidItemDrafts, setBidItemDrafts] = useState<Record<string, string>>({});
  const [layerDrafts, setLayerDrafts] = useState<Record<string, string>>({});

  async function commitField(
    id: string,
    field: 'label' | 'bidItemId' | 'layer',
    value: string,
  ) {
    const trimmed = value.trim();
    await onPatchSheet((sheet) => ({
      ...sheet,
      measurements: sheet.measurements.map((m) =>
        m.id === id ? { ...m, [field]: trimmed === '' ? undefined : trimmed } : m,
      ),
    }));
  }

  async function remove(id: string) {
    if (!confirm('Delete this measurement?')) return;
    await onPatchSheet((sheet) => ({
      ...sheet,
      measurements: sheet.measurements.filter((m) => m.id !== id),
    }));
  }

  if (measurements.length === 0) return null;

  // Unique layer set, plus a "no layer" bucket.
  const layerCounts = new Map<string, number>();
  for (const m of measurements) {
    const k = m.layer ?? NO_LAYER;
    layerCounts.set(k, (layerCounts.get(k) ?? 0) + 1);
  }
  const layers = Array.from(layerCounts.keys()).sort((a, b) => {
    if (a === NO_LAYER) return 1;
    if (b === NO_LAYER) return -1;
    return a.localeCompare(b);
  });

  // Rollup grouped by bidItemId → by unit.
  const byBidItem: Record<string, Partial<Record<PlanUnit, UnitTotal>>> = {};
  for (const m of measurements) {
    const key = m.bidItemId ?? UNASSIGNED;
    const v = measurementValue(m, scale);
    const group = (byBidItem[key] ??= {});
    const slot: UnitTotal = group[v.unit] ?? { value: 0, count: 0 };
    slot.value += v.value;
    slot.count += 1;
    group[v.unit] = slot;
  }
  const sortedBidKeys = Object.keys(byBidItem).sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  });

  return (
    <details className="border-b border-gray-200 bg-white" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50">
        Measurements ({measurements.length})
        {saving ? <span className="ml-2 text-blue-700">saving…</span> : null}
        {saveError ? <span className="ml-2 text-red-700">{saveError}</span> : null}
      </summary>

      {/* Layer toggles */}
      {layers.length > 1 || (layers[0] !== NO_LAYER) ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Layers:</span>
          {layers.map((layer) => {
            const visible = !hiddenLayers.has(layer);
            const label = layer === NO_LAYER ? '(no layer)' : layer;
            const count = layerCounts.get(layer) ?? 0;
            return (
              <label
                key={layer}
                className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 ${
                  visible ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-400 line-through'
                }`}
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => onToggleLayer(layer)}
                  className="h-3 w-3"
                />
                <span className="font-mono">{label}</span>
                <span className="text-gray-400">({count})</span>
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-semibold">Kind</th>
              <th className="px-3 py-1.5 text-left font-semibold">Label</th>
              <th className="px-3 py-1.5 text-right font-semibold">Value</th>
              <th className="px-3 py-1.5 text-left font-semibold">Bid item</th>
              <th className="px-3 py-1.5 text-left font-semibold">Layer</th>
              <th className="px-3 py-1.5 text-right font-semibold">Pts</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {measurements.map((m) => {
              const v = measurementValue(m, scale);
              const color = m.color ?? defaultMeasurementColor(m.kind);
              const labelDraft = labelDrafts[m.id];
              const labelCurrent = labelDraft ?? m.label ?? '';
              const bidDraft = bidItemDrafts[m.id];
              const bidCurrent = bidDraft ?? m.bidItemId ?? '';
              const layerDraft = layerDrafts[m.id];
              const layerCurrent = layerDraft ?? m.layer ?? '';
              const hidden = hiddenLayers.has(m.layer ?? NO_LAYER);
              return (
                <tr
                  key={m.id}
                  className={`hover:bg-gray-50 ${hidden ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-1">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase"
                      style={{ color }}
                    >
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                      {takeoffMeasurementKindLabel(m.kind)}
                    </span>
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={labelCurrent}
                      placeholder="—"
                      onChange={(e) =>
                        setLabelDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (labelDraft !== undefined && labelDraft !== (m.label ?? '')) {
                          void commitField(m.id, 'label', labelDraft);
                        }
                        setLabelDrafts((d) => {
                          const next = { ...d };
                          delete next[m.id];
                          return next;
                        });
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-sm">
                    {v.value.toFixed(v.unit === 'EA' ? 0 : 2)}{' '}
                    <span className="text-xs text-gray-500">{v.unit}</span>
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={bidCurrent}
                      placeholder="bid item id"
                      onChange={(e) =>
                        setBidItemDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (bidDraft !== undefined && bidDraft !== (m.bidItemId ?? '')) {
                          void commitField(m.id, 'bidItemId', bidDraft);
                        }
                        setBidItemDrafts((d) => {
                          const next = { ...d };
                          delete next[m.id];
                          return next;
                        });
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={layerCurrent}
                      placeholder="layer"
                      onChange={(e) =>
                        setLayerDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (layerDraft !== undefined && layerDraft !== (m.layer ?? '')) {
                          void commitField(m.id, 'layer', layerDraft);
                        }
                        setLayerDrafts((d) => {
                          const next = { ...d };
                          delete next[m.id];
                          return next;
                        });
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
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

      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          By bid item — push these totals into the bid editor
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {sortedBidKeys.map((key) => {
            const units = byBidItem[key] ?? {};
            const display =
              key === UNASSIGNED ? (
                <em className="text-gray-400">unassigned</em>
              ) : (
                <span className="font-mono font-semibold text-gray-900">{key}</span>
              );
            return (
              <div
                key={key}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              >
                {display}
                <span className="text-gray-400">·</span>
                {Object.entries(units).map(([unit, totals]) =>
                  totals ? (
                    <span key={unit} className="text-gray-700">
                      <strong>
                        {totals.value.toFixed(unit === 'EA' ? 0 : 2)}
                      </strong>{' '}
                      {unit}
                      <span className="ml-1 text-gray-400">({totals.count})</span>
                    </span>
                  ) : null,
                )}
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

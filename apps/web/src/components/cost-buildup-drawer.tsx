'use client';

// Per-line crew buildup drawer.
//
// Plain English: every bid item line has a unit price ($/CY, $/LF,
// etc.). The estimator usually arrives at that number from a stack
// of labor + equipment + material + sub costs. This drawer lets you
// punch in that stack — labor classes & hours, equipment & rates,
// materials & quantities — and see the resulting unit price live.
// Click "Use this unit price" and we PATCH it onto the line.
//
// Phase 1 saves the buildup on the bid item itself (PricedBidItem
// .costBuildup). When Postgres lands the structure flips to a real
// CostLine table; the drawer can stay the same.

import { useEffect, useMemo, useState } from 'react';
import {
  buildupUnitPriceCents,
  formatUSD,
  totalBuildupCents,
  type CostBuildup,
  type CostBuildupEquipment,
  type CostBuildupLabor,
  type CostBuildupMaterial,
  type PricedBidItem,
} from '@yge/shared';

function newId(prefix: string): string {
  return `${prefix}-${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

const EMPTY_BUILDUP: CostBuildup = {
  labor: [],
  equipment: [],
  materials: [],
};

interface Props {
  item: PricedBidItem;
  onClose: () => void;
  /** Save the new buildup. The parent runs the PATCH. */
  onSave: (buildup: CostBuildup) => Promise<void> | void;
  /** Apply the calculated unit price (in cents) to the line. */
  onApplyUnitPrice: (cents: number) => Promise<void> | void;
}

export function CostBuildupDrawer({ item, onClose, onSave, onApplyUnitPrice }: Props) {
  const [buildup, setBuildup] = useState<CostBuildup>(item.costBuildup ?? EMPTY_BUILDUP);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setBuildup(item.costBuildup ?? EMPTY_BUILDUP);
  }, [item]);

  const totalCents = useMemo(
    () => totalBuildupCents(buildup, item.quantity),
    [buildup, item.quantity],
  );
  const calcUnit = useMemo(
    () => buildupUnitPriceCents(buildup, item.quantity),
    [buildup, item.quantity],
  );

  async function persist(next: CostBuildup) {
    setBuildup(next);
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  function patchLabor(id: string, patch: Partial<CostBuildupLabor>) {
    void persist({
      ...buildup,
      labor: buildup.labor.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }
  function addLabor() {
    void persist({
      ...buildup,
      labor: [
        ...buildup.labor,
        {
          id: newId('lab'),
          classification: '',
          crewSize: 1,
          hours: 0,
          hourlyRateCents: 0,
          fringeRateCents: 0,
          perUnit: true,
        },
      ],
    });
  }
  function removeLabor(id: string) {
    void persist({ ...buildup, labor: buildup.labor.filter((l) => l.id !== id) });
  }

  function patchEquipment(id: string, patch: Partial<CostBuildupEquipment>) {
    void persist({
      ...buildup,
      equipment: buildup.equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }
  function addEquipment() {
    void persist({
      ...buildup,
      equipment: [
        ...buildup.equipment,
        {
          id: newId('eq'),
          name: '',
          hours: 0,
          hourlyRateCents: 0,
          perUnit: true,
        },
      ],
    });
  }
  function removeEquipment(id: string) {
    void persist({
      ...buildup,
      equipment: buildup.equipment.filter((e) => e.id !== id),
    });
  }

  function patchMaterial(id: string, patch: Partial<CostBuildupMaterial>) {
    void persist({
      ...buildup,
      materials: buildup.materials.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    });
  }
  function addMaterial() {
    void persist({
      ...buildup,
      materials: [
        ...buildup.materials,
        {
          id: newId('mat'),
          name: '',
          quantity: 0,
          unitCostCents: 0,
          perUnit: true,
        },
      ],
    });
  }
  function removeMaterial(id: string) {
    void persist({
      ...buildup,
      materials: buildup.materials.filter((m) => m.id !== id),
    });
  }

  return (
    <div
      role="dialog"
      aria-label={`Crew buildup for item ${item.itemNumber}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-gray-300 bg-white shadow-2xl"
    >
      <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Crew buildup — Item {item.itemNumber}
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            {item.description} ·{' '}
            <span className="font-mono">
              {item.quantity.toLocaleString()} {item.unit}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Close ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 text-sm">
        <Section
          title="Labor"
          subtitle="Crew size × hours × (base + fringes). Per-unit means hours scale with the bid quantity."
          onAdd={addLabor}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-gray-500">
                <th className="px-1 py-1">Classification</th>
                <th className="px-1 py-1 text-right">Crew</th>
                <th className="px-1 py-1 text-right">Hours</th>
                <th className="px-1 py-1 text-right">Base $/hr</th>
                <th className="px-1 py-1 text-right">Fringe $/hr</th>
                <th className="px-1 py-1 text-center">Per unit</th>
                <th className="px-1 py-1 text-right">Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {buildup.labor.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-1 py-2 italic text-gray-400">
                    No labor lines yet — add a row to get started.
                  </td>
                </tr>
              )}
              {buildup.labor.map((l) => {
                const perHour = l.hourlyRateCents + l.fringeRateCents;
                const hours = l.perUnit
                  ? l.crewSize * l.hours * item.quantity
                  : l.crewSize * l.hours;
                const sub = Math.round(hours * perHour);
                return (
                  <tr key={l.id}>
                    <td className="px-1 py-1">
                      <input
                        value={l.classification}
                        onChange={(e) =>
                          patchLabor(l.id, { classification: e.target.value })
                        }
                        placeholder="e.g. Operator Group 4"
                        className="w-full rounded border border-gray-300 px-1 py-0.5"
                      />
                    </td>
                    <NumberCell
                      value={l.crewSize}
                      onChange={(n) => patchLabor(l.id, { crewSize: n })}
                      width="w-14"
                    />
                    <NumberCell
                      value={l.hours}
                      onChange={(n) => patchLabor(l.id, { hours: n })}
                      width="w-16"
                    />
                    <DollarCell
                      cents={l.hourlyRateCents}
                      onChange={(c) => patchLabor(l.id, { hourlyRateCents: c })}
                      width="w-20"
                    />
                    <DollarCell
                      cents={l.fringeRateCents}
                      onChange={(c) => patchLabor(l.id, { fringeRateCents: c })}
                      width="w-20"
                    />
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={l.perUnit}
                        onChange={(e) =>
                          patchLabor(l.id, { perUnit: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(sub)}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLabor(l.id)}
                        className="text-gray-400 hover:text-red-700"
                        aria-label={`Remove labor line ${l.classification || 'unnamed'}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="Equipment"
          subtitle="Hourly equipment cost — owned-and-operated, rented, or both."
          onAdd={addEquipment}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-gray-500">
                <th className="px-1 py-1">Equipment</th>
                <th className="px-1 py-1 text-right">Hours</th>
                <th className="px-1 py-1 text-right">$/hr</th>
                <th className="px-1 py-1 text-center">Per unit</th>
                <th className="px-1 py-1 text-right">Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {buildup.equipment.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-1 py-2 italic text-gray-400">
                    No equipment lines yet.
                  </td>
                </tr>
              )}
              {buildup.equipment.map((e) => {
                const hours = e.perUnit ? e.hours * item.quantity : e.hours;
                const sub = Math.round(hours * e.hourlyRateCents);
                return (
                  <tr key={e.id}>
                    <td className="px-1 py-1">
                      <input
                        value={e.name}
                        onChange={(ev) =>
                          patchEquipment(e.id, { name: ev.target.value })
                        }
                        placeholder="e.g. CAT 320 Excavator"
                        className="w-full rounded border border-gray-300 px-1 py-0.5"
                      />
                    </td>
                    <NumberCell
                      value={e.hours}
                      onChange={(n) => patchEquipment(e.id, { hours: n })}
                      width="w-16"
                    />
                    <DollarCell
                      cents={e.hourlyRateCents}
                      onChange={(c) =>
                        patchEquipment(e.id, { hourlyRateCents: c })
                      }
                      width="w-20"
                    />
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={e.perUnit}
                        onChange={(ev) =>
                          patchEquipment(e.id, { perUnit: ev.target.checked })
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(sub)}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeEquipment(e.id)}
                        className="text-gray-400 hover:text-red-700"
                        aria-label={`Remove equipment line ${e.name || 'unnamed'}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="Materials"
          subtitle="Quantity × unit cost. Per-unit means quantity scales with the bid quantity."
          onAdd={addMaterial}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wide text-gray-500">
                <th className="px-1 py-1">Material</th>
                <th className="px-1 py-1 text-right">Qty</th>
                <th className="px-1 py-1 text-right">$/unit</th>
                <th className="px-1 py-1 text-center">Per unit</th>
                <th className="px-1 py-1 text-right">Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {buildup.materials.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-1 py-2 italic text-gray-400">
                    No materials yet.
                  </td>
                </tr>
              )}
              {buildup.materials.map((m) => {
                const qty = m.perUnit ? m.quantity * item.quantity : m.quantity;
                const sub = Math.round(qty * m.unitCostCents);
                return (
                  <tr key={m.id}>
                    <td className="px-1 py-1">
                      <input
                        value={m.name}
                        onChange={(ev) =>
                          patchMaterial(m.id, { name: ev.target.value })
                        }
                        placeholder="e.g. AC paving"
                        className="w-full rounded border border-gray-300 px-1 py-0.5"
                      />
                    </td>
                    <NumberCell
                      value={m.quantity}
                      onChange={(n) => patchMaterial(m.id, { quantity: n })}
                      width="w-20"
                    />
                    <DollarCell
                      cents={m.unitCostCents}
                      onChange={(c) =>
                        patchMaterial(m.id, { unitCostCents: c })
                      }
                      width="w-24"
                    />
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={m.perUnit}
                        onChange={(ev) =>
                          patchMaterial(m.id, { perUnit: ev.target.checked })
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-right font-mono">
                      {formatUSD(sub)}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeMaterial(m.id)}
                        className="text-gray-400 hover:text-red-700"
                        aria-label={`Remove material line ${m.name || 'unnamed'}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section title="Sub lump sum & notes" subtitle="">
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-gray-700">Sub lump sum</span>
              <DollarCell
                cents={buildup.subLumpSumCents ?? 0}
                onChange={(c) =>
                  void persist({
                    ...buildup,
                    subLumpSumCents: c > 0 ? c : undefined,
                  })
                }
                width="w-32"
              />
            </label>
            <label className="block">
              <span className="block text-gray-700">Notes</span>
              <textarea
                value={buildup.notes ?? ''}
                onChange={(e) =>
                  void persist({
                    ...buildup,
                    notes: e.target.value || undefined,
                  })
                }
                placeholder="Productivity assumptions, exclusions, etc."
                className="mt-1 h-16 w-full rounded border border-gray-300 px-2 py-1"
                maxLength={500}
              />
            </label>
          </div>
        </Section>
      </div>

      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Total at {item.quantity.toLocaleString()} {item.unit}
            </div>
            <div className="font-mono text-base font-semibold">
              {formatUSD(totalCents)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Calculated unit price
            </div>
            <div className="font-mono text-base font-semibold">
              {calcUnit == null ? '—' : `${formatUSD(calcUnit)} / ${item.unit}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-gray-400">Saving…</span>}
            {applied && (
              <span className="text-xs text-green-700">
                ✓ Applied to line
              </span>
            )}
            <button
              type="button"
              disabled={calcUnit == null || saving}
              onClick={async () => {
                if (calcUnit == null) return;
                await onApplyUnitPrice(calcUnit);
                setApplied(true);
                window.setTimeout(() => setApplied(false), 2500);
              }}
              className="rounded-md bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use this unit price →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---- Subcomponents -------------------------------------------------------

function Section({
  title,
  subtitle,
  onAdd,
  children,
}: {
  title: string;
  subtitle: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-md border border-gray-200 bg-gray-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded border border-blue-700 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
          >
            + Add row
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function NumberCell({
  value,
  onChange,
  width,
}: {
  value: number;
  onChange: (n: number) => void;
  width: string;
}) {
  const [text, setText] = useState(value === 0 ? '' : String(value));
  useEffect(() => {
    setText(value === 0 ? '' : String(value));
  }, [value]);
  return (
    <td className="px-1 py-1 text-right">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(/[,\s]/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            setText(value === 0 ? '' : String(value));
            return;
          }
          if (n !== value) onChange(n);
        }}
        placeholder="0"
        className={`${width} rounded border border-gray-300 px-1 py-0.5 text-right font-mono`}
      />
    </td>
  );
}

function DollarCell({
  cents,
  onChange,
  width,
}: {
  cents: number;
  onChange: (cents: number) => void;
  width: string;
}) {
  const [text, setText] = useState(cents === 0 ? '' : (cents / 100).toFixed(2));
  useEffect(() => {
    setText(cents === 0 ? '' : (cents / 100).toFixed(2));
  }, [cents]);
  return (
    <td className="px-1 py-1 text-right">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(/[$,\s]/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            setText(cents === 0 ? '' : (cents / 100).toFixed(2));
            return;
          }
          const next = Math.round(n * 100);
          if (next !== cents) onChange(next);
        }}
        placeholder="0.00"
        className={`${width} rounded border border-gray-300 px-1 py-0.5 text-right font-mono`}
      />
    </td>
  );
}

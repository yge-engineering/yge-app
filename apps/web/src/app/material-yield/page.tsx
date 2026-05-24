'use client';

// /material-yield — bank ↔ loose ↔ compacted CY calculator.
//
// Wires material-yield.ts into a real estimator's tool. Inputs:
// material, amount, and which state the amount is in. Outputs:
// the other two states with their factors + a quick end-dump
// truck-loads count for the loose state.

import { useMemo, useState } from 'react';
import {
  convertVolume,
  endDumpLoadsForExcavation,
  type MaterialKind,
  type VolumeState,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

// Per-material label for the select. Order matches the typical
// frequency in YGE bids (earthwork first, paving last).
const MATERIAL_OPTIONS: Array<{ value: MaterialKind; label: string }> = [
  { value: 'NATIVE_SOIL', label: 'Native NorCal soil' },
  { value: 'IMPORT_BORROW', label: 'Imported borrow' },
  { value: 'AGGREGATE_BASE_CLASS_2', label: 'Class 2 aggregate base' },
  { value: 'AGGREGATE_BASE_CLASS_3', label: 'Class 3 aggregate base' },
  { value: 'CRUSHED_MISC_BASE', label: 'Crushed misc base (CMB)' },
  { value: 'DRAIN_ROCK_34', label: '3/4" drain rock' },
  { value: 'RIPRAP_QUARTER_TON', label: 'Quarter-ton riprap' },
  { value: 'HMA_TYPE_A', label: 'Hot mix asphalt (Type A)' },
  { value: 'PCC_STRUCTURAL', label: 'Structural PCC' },
];

const STATE_OPTIONS: Array<{ value: VolumeState; label: string; hint: string }> = [
  { value: 'bank', label: 'Bank CY', hint: 'in-situ / cut volume' },
  { value: 'loose', label: 'Loose CY', hint: 'truck-haul / loose-dump' },
  { value: 'compacted', label: 'Compacted CY', hint: 'placed in fill / finished volume' },
];

function fmtCY(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' CY';
}

export default function MaterialYieldPage() {
  const [material, setMaterial] = useState<MaterialKind>('NATIVE_SOIL');
  const [amount, setAmount] = useState('1000');
  const [state, setState] = useState<VolumeState>('bank');
  const [truckCapacity, setTruckCapacity] = useState('12');

  const conversions = useMemo(() => {
    const amountCY = Number(amount) || 0;
    return STATE_OPTIONS.map((s) =>
      convertVolume(material, { amountCY, state }, s.value),
    );
  }, [material, amount, state]);

  const truckLoads = useMemo(() => {
    const amountCY = Number(amount) || 0;
    const capCY = Number(truckCapacity) || 12;
    if (amountCY <= 0 || capCY <= 0) return 0;
    // Convert input to bank CY first if needed, then use the helper
    // which assumes bank-CY input. For loose/compacted inputs, run the
    // conversion ourselves so the helper's bank-only contract holds.
    const bankCY =
      state === 'bank'
        ? amountCY
        : convertVolume(material, { amountCY, state }, 'bank').amountCY;
    return endDumpLoadsForExcavation(material, bankCY, capCY);
  }, [material, amount, state, truckCapacity]);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <PageHeader
          title="Material yield calculator"
          subtitle="Bank ↔ loose ↔ compacted volume math for the materials YGE bids most. Factors from CalTrans + AGC handbook averages — override per pit when lab data exists."
        />

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-gray-700">Material</span>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as MaterialKind)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              >
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">Amount</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm tabular-nums"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">In state</span>
              <select
                value={state}
                onChange={(e) => setState(e.target.value as VolumeState)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              >
                {STATE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">Truck capacity (loose CY)</span>
              <input
                type="number"
                inputMode="decimal"
                value={truckCapacity}
                onChange={(e) => setTruckCapacity(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm tabular-nums"
              />
              <span className="mt-0.5 block text-xs text-gray-500">
                Default 12 (typical end-dump). Belly dumps 14–18.
              </span>
            </label>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {conversions.map((c) => {
            const isSource = c.toState === state;
            return (
              <div
                key={c.toState}
                className={`rounded-md border p-4 ${isSource ? 'border-yge-blue-300 bg-yge-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {STATE_OPTIONS.find((s) => s.value === c.toState)!.label}
                  {isSource && (
                    <span className="ml-2 rounded bg-yge-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-yge-blue-800">
                      input
                    </span>
                  )}
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
                  {fmtCY(c.amountCY)}
                </div>
                <p className="mt-1 text-xs text-gray-500">×{c.factor.toFixed(3)}</p>
                <p className="mt-2 text-xs italic text-gray-500">{c.note}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Trucking
          </h3>
          <p className="mt-2 text-sm text-gray-700">
            ≈ <span className="text-lg font-semibold text-gray-900 tabular-nums">{truckLoads.toLocaleString()}</span>{' '}
            end-dump loads at {truckCapacity || '12'} loose-CY capacity.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Rounded up — partial loads still cost a full truck day.
          </p>
        </section>
      </main>
    </AppShell>
  );
}

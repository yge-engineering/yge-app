'use client';

// Material editor — header fields + movement ledger.
//
// Movement entry uses the dedicated /movement endpoint so the
// quantity-on-hand updates atomically with the ledger append.

import { useState } from 'react';
import {
  formatUSD,
  isBelowReorder,
  materialCategoryLabel,
  movementKindLabel,
  type Job,
  type Material,
  type MaterialCategory,
  type StockMovementKind,
} from '@yge/shared';

const CATEGORIES: MaterialCategory[] = [
  'AGGREGATE',
  'ASPHALT',
  'CONCRETE',
  'REBAR',
  'PIPE',
  'FITTING',
  'GEOTEXTILE',
  'EROSION_CONTROL',
  'SIGN',
  'PAINT',
  'WELDING',
  'FUEL',
  'LUBRICANT',
  'FASTENER',
  'SAFETY',
  'ELECTRICAL',
  'CONSUMABLE',
  'OTHER',
];

const KINDS: StockMovementKind[] = [
  'RECEIVED',
  'CONSUMED',
  'RETURNED',
  'ADJUSTED',
  'TRANSFERRED',
];

interface Props {
  initial: Material;
  jobs: Job[];
  apiBaseUrl: string;
}

export function MaterialEditor({ initial, jobs, apiBaseUrl }: Props) {
  const [m, setM] = useState<Material>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(m.name);
  const [sku, setSku] = useState(m.sku ?? '');
  const [unit, setUnit] = useState(m.unit);
  const [reorderPoint, setReorderPoint] = useState(m.reorderPoint?.toString() ?? '');
  const [unitCostDollars, setUnitCostDollars] = useState(
    m.unitCostCents !== undefined ? (m.unitCostCents / 100).toFixed(2) : '',
  );
  const [location, setLocation] = useState(m.location ?? '');
  const [preferredVendor, setPreferredVendor] = useState(m.preferredVendor ?? '');
  const [notes, setNotes] = useState(m.notes ?? '');

  // Movement form.
  const [movKind, setMovKind] = useState<StockMovementKind>('RECEIVED');
  const [movQty, setMovQty] = useState('');
  const [movJobId, setMovJobId] = useState('');
  const [movNote, setMovNote] = useState('');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/materials/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { material: Material };
      setM(json.material);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    void patch({
      name: name.trim() || m.name,
      sku: sku.trim() || undefined,
      unit: unit.trim() || m.unit,
      reorderPoint: reorderPoint.trim() ? Number(reorderPoint) : undefined,
      unitCostCents: unitCostDollars.trim()
        ? Math.round(Number(unitCostDollars) * 100)
        : undefined,
      location: location.trim() || undefined,
      preferredVendor: preferredVendor.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  async function recordMovement() {
    const qty = Number(movQty);
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Movement quantity must be a non-negative number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/materials/${m.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: movKind,
          quantity: qty,
          ...(movJobId ? { jobId: movJobId } : {}),
          ...(movNote.trim() ? { note: movNote.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Movement failed: ${res.status}`);
      const json = (await res.json()) as { material: Material };
      setM(json.material);
      setMovQty('');
      setMovNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Movement failed');
    } finally {
      setSaving(false);
    }
  }

  const below = isBelowReorder(m);
  const out = m.quantityOnHand <= 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {materialCategoryLabel(m.category)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{m.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {m.quantityOnHand} {m.unit} on hand
            {m.unitCostCents !== undefined && (
              <>
                {' '}\u00b7 {formatUSD(m.unitCostCents)} each \u00b7{' '}
                {formatUSD(Math.round(m.quantityOnHand * m.unitCostCents))} total
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={m.category}
            onChange={(e) => void patch({ category: e.target.value as MaterialCategory })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {materialCategoryLabel(c)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">Saving&hellip;</span>}
        </div>
      </header>

      {(out || below) && (
        <div
          className={`rounded border p-3 text-sm ${out ? 'border-red-300 bg-red-50 text-red-800' : 'border-yellow-300 bg-yellow-50 text-yellow-800'}`}
        >
          <strong>{out ? 'Out of stock.' : 'Below reorder point.'}</strong>
          {' '}Time to order more from{' '}
          {m.preferredVendor ? <em>{m.preferredVendor}</em> : 'your preferred vendor'}.
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Movement entry */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Record movement</h2>
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-5">
            <Field label="Kind">
              <select
                value={movKind}
                onChange={(e) => setMovKind(e.target.value as StockMovementKind)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {movementKindLabel(k)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Quantity (${m.unit})`}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={movQty}
                onChange={(e) => setMovQty(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Job">
              <select
                value={movJobId}
                onChange={(e) => setMovJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">— None —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input
                value={movNote}
                onChange={(e) => setMovNote(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={recordMovement}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Movement ledger */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Movement ledger</h2>
        {m.movements.length === 0 ? (
          <p className="text-sm text-gray-500">No movements recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {[...m.movements]
              .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
              .map((mov) => {
                const job = mov.jobId ? jobs.find((j) => j.id === mov.jobId) : undefined;
                return (
                  <li key={mov.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {movementKindLabel(mov.kind)} &middot; {mov.quantity} {m.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(mov.recordedAt).toLocaleString()}
                        {job && (
                          <>
                            {' '}\u00b7 {job.projectName}
                          </>
                        )}
                        {mov.note && (
                          <>
                            {' '}\u00b7 {mov.note}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* Header fields */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="SKU">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Unit">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Reorder point">
          <input
            type="number"
            min="0"
            step="0.01"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Unit cost ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitCostDollars}
            onChange={(e) => setUnitCostDollars(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Location">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Preferred vendor">
          <input
            value={preferredVendor}
            onChange={(e) => setPreferredVendor(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

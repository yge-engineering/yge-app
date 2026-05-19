'use client';

// Equipment rate book CRUD UI.
//
// Two kinds: OWNED (bare $/hr + fuel/hr → total $/hr) and RENTAL
// (daily / weekly / monthly cents). The "Add rate" form switches
// between the two; rows in the table show the values relevant to
// their kind.

import { useEffect, useState } from 'react';
import type {
  EquipmentRate,
  EquipmentRateCreate,
  EquipmentRateKind,
  EquipmentRatePatch,
  EquipmentRateSource,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function dollarsToCents(input: string): number {
  const n = Number.parseFloat(input.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
function centsInput(c: number | null | undefined): string {
  if (c == null) return '';
  return (c / 100).toFixed(2);
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs';
const selectClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs bg-white';
const moneyInputClass = 'w-24 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono';

interface AddForm {
  costCode: string;
  name: string;
  kind: EquipmentRateKind;
  // OWNED
  bareDollars: string;
  fuelDollarsPerHour: string;
  totalDollarsPerHour: string;
  gallonsPerHour: string;
  // RENTAL
  category: string;
  dailyDollars: string;
  weeklyDollars: string;
  monthlyDollars: string;
  source: EquipmentRateSource;
  notes: string;
}
const EMPTY: AddForm = {
  costCode: '',
  name: '',
  kind: 'OWNED',
  bareDollars: '',
  fuelDollarsPerHour: '',
  totalDollarsPerHour: '',
  gallonsPerHour: '',
  category: '',
  dailyDollars: '',
  weeklyDollars: '',
  monthlyDollars: '',
  source: 'Estimated',
  notes: '',
};

export function EquipmentRateManager() {
  const [rows, setRows] = useState<EquipmentRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY);
  const [search, setSearch] = useState('');
  // Per-row pending edits.
  const [edits, setEdits] = useState<Record<string, {
    name?: string;
    bareDollars?: string;
    fuelDollarsPerHour?: string;
    totalDollarsPerHour?: string;
    dailyDollars?: string;
    weeklyDollars?: string;
    monthlyDollars?: string;
    notes?: string;
  }>>({});

  async function reload(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/equipment-rates`, { cache: 'no-store' });
      if (!res.ok) { setError(`API ${res.status}`); setRows([]); return; }
      const data = (await res.json()) as { equipmentRates?: EquipmentRate[] };
      setRows(data.equipmentRates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    }
  }
  useEffect(() => { void reload(); }, []);

  async function add(): Promise<void> {
    setError(null);
    if (!form.costCode.trim() || !form.name.trim()) {
      setError('Cost code and name are required.');
      return;
    }
    const base: EquipmentRateCreate = {
      costCode: form.costCode.trim().toUpperCase(),
      name: form.name.trim(),
      kind: form.kind,
      source: form.source,
      notes: form.notes.trim() || undefined,
    };
    if (form.kind === 'OWNED') {
      Object.assign(base, {
        bareRateCents: form.bareDollars ? dollarsToCents(form.bareDollars) : undefined,
        fuelCentsPerHour: form.fuelDollarsPerHour ? dollarsToCents(form.fuelDollarsPerHour) : undefined,
        totalCentsPerHour: form.totalDollarsPerHour ? dollarsToCents(form.totalDollarsPerHour) : undefined,
        gallonsPerHour: form.gallonsPerHour ? Number.parseFloat(form.gallonsPerHour) : undefined,
        unit: 'hr',
      });
    } else {
      Object.assign(base, {
        category: form.category.trim() || undefined,
        dailyCents: form.dailyDollars ? dollarsToCents(form.dailyDollars) : undefined,
        weeklyCents: form.weeklyDollars ? dollarsToCents(form.weeklyDollars) : undefined,
        monthlyCents: form.monthlyDollars ? dollarsToCents(form.monthlyDollars) : undefined,
      });
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/equipment-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setError(b.error ?? `Add failed (${res.status}).`);
        return;
      }
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  async function save(id: string): Promise<void> {
    const pending = edits[id];
    if (!pending) return;
    const patch: EquipmentRatePatch = {};
    if (pending.name !== undefined) patch.name = pending.name;
    if (pending.notes !== undefined) patch.notes = pending.notes || undefined;
    if (pending.bareDollars !== undefined) patch.bareRateCents = dollarsToCents(pending.bareDollars);
    if (pending.fuelDollarsPerHour !== undefined) patch.fuelCentsPerHour = dollarsToCents(pending.fuelDollarsPerHour);
    if (pending.totalDollarsPerHour !== undefined) patch.totalCentsPerHour = dollarsToCents(pending.totalDollarsPerHour);
    if (pending.dailyDollars !== undefined) patch.dailyCents = dollarsToCents(pending.dailyDollars);
    if (pending.weeklyDollars !== undefined) patch.weeklyCents = dollarsToCents(pending.weeklyDollars);
    if (pending.monthlyDollars !== undefined) patch.monthlyCents = dollarsToCents(pending.monthlyDollars);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/equipment-rates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { setError(`Save failed (${res.status}).`); return; }
      setEdits((e) => { const { [id]: _drop, ...rest } = e; return rest; });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  async function del(id: string): Promise<void> {
    if (!confirm('Delete this equipment rate?')) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/equipment-rates/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(`Delete failed (${res.status}).`); return; }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  function setEdit(id: string, key: string, value: unknown): void {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  const visible = rows
    ? rows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return r.costCode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      })
    : null;

  return (
    <div className="space-y-6">
      {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Add an equipment rate</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Cost code">
            <input type="text" value={form.costCode}
              onChange={(e) => setForm({ ...form, costCode: e.target.value })}
              className={inputClass} placeholder="EQP-EX-24T" />
          </Field>
          <Field label="Name">
            <input type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass} placeholder="Excavator 24-ton" />
          </Field>
          <Field label="Kind">
            <select className={selectClass} value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as EquipmentRateKind })}>
              <option value="OWNED">OWNED (YGE iron)</option>
              <option value="RENTAL">RENTAL (vendor)</option>
            </select>
          </Field>
          <Field label="Source">
            <select className={selectClass} value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value as EquipmentRateSource })}>
              <option value="Confirmed">Confirmed (vendor quote)</option>
              <option value="Estimated">Estimated</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          {form.kind === 'OWNED' ? (
            <>
              <Field label="Bare $/hr">
                <input type="text" inputMode="decimal" value={form.bareDollars}
                  onChange={(e) => setForm({ ...form, bareDollars: e.target.value })}
                  className={inputClass} placeholder="85.00" />
              </Field>
              <Field label="Fuel $/hr">
                <input type="text" inputMode="decimal" value={form.fuelDollarsPerHour}
                  onChange={(e) => setForm({ ...form, fuelDollarsPerHour: e.target.value })}
                  className={inputClass} placeholder="22.50" />
              </Field>
              <Field label="Total $/hr">
                <input type="text" inputMode="decimal" value={form.totalDollarsPerHour}
                  onChange={(e) => setForm({ ...form, totalDollarsPerHour: e.target.value })}
                  className={inputClass} placeholder="107.50" />
              </Field>
              <Field label="Gallons/hr">
                <input type="text" inputMode="decimal" value={form.gallonsPerHour}
                  onChange={(e) => setForm({ ...form, gallonsPerHour: e.target.value })}
                  className={inputClass} placeholder="4.5" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Category">
                <input type="text" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass} placeholder="Excavators" />
              </Field>
              <Field label="Daily $">
                <input type="text" inputMode="decimal" value={form.dailyDollars}
                  onChange={(e) => setForm({ ...form, dailyDollars: e.target.value })}
                  className={inputClass} placeholder="650.00" />
              </Field>
              <Field label="Weekly $">
                <input type="text" inputMode="decimal" value={form.weeklyDollars}
                  onChange={(e) => setForm({ ...form, weeklyDollars: e.target.value })}
                  className={inputClass} placeholder="2200.00" />
              </Field>
              <Field label="Monthly $">
                <input type="text" inputMode="decimal" value={form.monthlyDollars}
                  onChange={(e) => setForm({ ...form, monthlyDollars: e.target.value })}
                  className={inputClass} placeholder="6500.00" />
              </Field>
            </>
          )}
          <Field label="Notes" wide>
            <input type="text" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass} placeholder="Free-form" />
          </Field>
        </div>
        <div className="mt-3">
          <button type="button" onClick={add} disabled={busy}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Add rate'}
          </button>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <div className="text-sm font-semibold text-gray-800">
            Equipment rates {visible ? `(${visible.length}${rows && rows.length !== visible.length ? ` / ${rows.length}` : ''})` : ''}
          </div>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="filter…" className="rounded border border-gray-300 px-2 py-1 text-xs" />
        </div>
        {!visible ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No rates match. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Code</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Kind</th>
                  <th className="px-2 py-2 text-right">Bare/hr</th>
                  <th className="px-2 py-2 text-right">Fuel/hr</th>
                  <th className="px-2 py-2 text-right">Total/hr</th>
                  <th className="px-2 py-2 text-right">Daily</th>
                  <th className="px-2 py-2 text-right">Weekly</th>
                  <th className="px-2 py-2 text-right">Monthly</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => {
                  const e = edits[r.id] ?? {};
                  const dirty = Object.keys(e).length > 0;
                  const owned = r.kind === 'OWNED';
                  return (
                    <tr key={r.id} className={dirty ? 'bg-amber-50' : ''}>
                      <td className="px-2 py-1.5 font-mono text-xs">{r.costCode}</td>
                      <td className="px-2 py-1.5">
                        <input type="text" defaultValue={r.name}
                          onChange={(ev) => setEdit(r.id, 'name', ev.target.value)}
                          className={inputClass + ' min-w-[180px]'} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-600">{r.kind}</td>
                      <td className="px-2 py-1.5 text-right">
                        {owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.bareRateCents)}
                            onChange={(ev) => setEdit(r.id, 'bareDollars', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.fuelCentsPerHour)}
                            onChange={(ev) => setEdit(r.id, 'fuelDollarsPerHour', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.totalCentsPerHour)}
                            onChange={(ev) => setEdit(r.id, 'totalDollarsPerHour', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {!owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.dailyCents)}
                            onChange={(ev) => setEdit(r.id, 'dailyDollars', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {!owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.weeklyCents)}
                            onChange={(ev) => setEdit(r.id, 'weeklyDollars', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {!owned ? (
                          <input type="text" inputMode="decimal" defaultValue={centsInput(r.monthlyCents)}
                            onChange={(ev) => setEdit(r.id, 'monthlyDollars', ev.target.value)}
                            className={moneyInputClass} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {dirty && (
                          <button type="button" onClick={() => save(r.id)} disabled={busy}
                            className="mr-2 rounded bg-yge-blue-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
                            Save
                          </button>
                        )}
                        <button type="button" onClick={() => del(r.id)} disabled={busy}
                          className="rounded border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-xs ${wide ? 'sm:col-span-4' : ''}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

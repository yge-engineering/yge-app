'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EquipmentRate,
  EquipmentRateKind,
  EquipmentRateSource,
} from '@yge/shared';

const SOURCES: EquipmentRateSource[] = ['Confirmed', 'Estimated', 'Other'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function fmtMoney(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

interface DraftRate {
  id?: string;
  costCode: string;
  name: string;
  kind: EquipmentRateKind;
  // OWNED
  bareRateDollars: string;
  gallonsPerHour: string;
  fuelDollarsPerHour: string;
  totalDollarsPerHour: string;
  unit: string;
  // RENTAL
  category: string;
  dailyDollars: string;
  weeklyDollars: string;
  monthlyDollars: string;
  source: EquipmentRateSource;
  // both
  notes: string;
}

const blankDraft: DraftRate = {
  costCode: '',
  name: '',
  kind: 'OWNED',
  bareRateDollars: '',
  gallonsPerHour: '',
  fuelDollarsPerHour: '',
  totalDollarsPerHour: '',
  unit: 'hr',
  category: '',
  dailyDollars: '',
  weeklyDollars: '',
  monthlyDollars: '',
  source: 'Other',
  notes: '',
};

function dollarsToCents(s: string): number | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}
function centsToDollars(c: number | undefined): string {
  if (c === undefined || c === null) return '';
  return (c / 100).toFixed(2);
}

export function EquipmentRatesTable({ rates }: { rates: EquipmentRate[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<EquipmentRateKind | ''>('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<DraftRate | null>(null);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return rates.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (!norm) return true;
      return (
        r.costCode.toLowerCase().includes(norm) ||
        r.name.toLowerCase().includes(norm) ||
        (r.category ?? '').toLowerCase().includes(norm)
      );
    });
  }, [rates, q, kind]);

  function startNew() {
    setEditing({ ...blankDraft });
  }
  function startEdit(r: EquipmentRate) {
    setEditing({
      id: r.id,
      costCode: r.costCode,
      name: r.name,
      kind: r.kind,
      bareRateDollars: centsToDollars(r.bareRateCents),
      gallonsPerHour: r.gallonsPerHour !== undefined ? String(r.gallonsPerHour) : '',
      fuelDollarsPerHour: centsToDollars(r.fuelCentsPerHour),
      totalDollarsPerHour: centsToDollars(r.totalCentsPerHour),
      unit: r.unit ?? 'hr',
      category: r.category ?? '',
      dailyDollars: centsToDollars(r.dailyCents),
      weeklyDollars: centsToDollars(r.weeklyCents),
      monthlyDollars: centsToDollars(r.monthlyCents),
      source: r.source ?? 'Other',
      notes: r.notes ?? '',
    });
  }

  async function save(d: DraftRate) {
    const body: Record<string, unknown> = {
      costCode: d.costCode.trim(),
      name: d.name.trim(),
      kind: d.kind,
    };
    if (d.kind === 'OWNED') {
      const bare = dollarsToCents(d.bareRateDollars);
      const fuel = dollarsToCents(d.fuelDollarsPerHour);
      const total = dollarsToCents(d.totalDollarsPerHour);
      const gph = d.gallonsPerHour.trim() ? Number(d.gallonsPerHour) : undefined;
      if (bare !== undefined) body.bareRateCents = bare;
      if (gph !== undefined && Number.isFinite(gph) && gph >= 0) body.gallonsPerHour = gph;
      if (fuel !== undefined) body.fuelCentsPerHour = fuel;
      if (total !== undefined) body.totalCentsPerHour = total;
      if (d.unit.trim()) body.unit = d.unit.trim();
    } else {
      const daily = dollarsToCents(d.dailyDollars);
      const weekly = dollarsToCents(d.weeklyDollars);
      const monthly = dollarsToCents(d.monthlyDollars);
      if (daily !== undefined) body.dailyCents = daily;
      if (weekly !== undefined) body.weeklyCents = weekly;
      if (monthly !== undefined) body.monthlyCents = monthly;
      if (d.category.trim()) body.category = d.category.trim();
      body.source = d.source;
    }
    if (d.notes.trim()) body.notes = d.notes.trim();

    const url = d.id
      ? `${API_BASE_URL}/api/equipment-rates/${d.id}`
      : `${API_BASE_URL}/api/equipment-rates`;
    const res = await fetch(url, {
      method: d.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Save failed (${res.status}): ${text.slice(0, 120)}`);
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(r: EquipmentRate) {
    if (!confirm(`Delete "${r.name}" (${r.costCode})? This cannot be undone.`))
      return;
    const res = await fetch(`${API_BASE_URL}/api/equipment-rates/${r.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      alert(`Delete failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-300 bg-white">
            {(['', 'OWNED', 'RENTAL'] as const).map((k) => (
              <button
                key={k || 'all'}
                type="button"
                onClick={() => setKind(k as EquipmentRateKind | '')}
                className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md last:rounded-r-md ${kind === k ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {k === '' ? 'All' : k === 'OWNED' ? 'Owned' : 'Rental'}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name, or category…"
            className="w-72 max-w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-gray-500">
            {filtered.length} of {rates.length}
          </span>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + New rate
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Daily</th>
              <th className="px-3 py-2 text-right">Weekly</th>
              <th className="px-3 py-2 text-right">Monthly</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">
                  No rates match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="group hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.costCode}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 ${r.kind === 'OWNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                    >
                      {r.kind === 'OWNED' ? 'Owned' : 'Rental'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'OWNED'
                      ? `${fmtMoney(r.totalCentsPerHour)} / hr`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.dailyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.weeklyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.monthlyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.notes ?? '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="text-xs text-gray-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                    >
                      Edit
                    </button>
                    <span className="px-1 text-gray-300 opacity-0 group-hover:opacity-100">·</span>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      className="text-xs text-red-700 opacity-0 transition group-hover:opacity-100 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <RateModal
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function RateModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: DraftRate;
  onCancel: () => void;
  onSave: (d: DraftRate) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!draft.costCode.trim()) {
      setError('Code is required.');
      return;
    }
    if (!draft.name.trim()) {
      setError('Equipment name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {draft.id ? 'Edit rate' : 'New rate'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost code">
              <input
                value={draft.costCode}
                onChange={(e) => setDraft({ ...draft, costCode: e.target.value })}
                placeholder="EQP-EX-MINI"
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                autoFocus
              />
            </Field>
            <Field label="Kind">
              <select
                value={draft.kind}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as EquipmentRateKind })
                }
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="OWNED">Owned</option>
                <option value="RENTAL">Rental</option>
              </select>
            </Field>
          </div>

          <Field label="Equipment name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Excavator — Mini (CAT 305/308, ≤5T)"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          {draft.kind === 'OWNED' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bare rate ($/hr)">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.bareRateDollars}
                    onChange={(e) => setDraft({ ...draft, bareRateDollars: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Gallons / hr">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.gallonsPerHour}
                    onChange={(e) => setDraft({ ...draft, gallonsPerHour: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fuel $/hr">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.fuelDollarsPerHour}
                    onChange={(e) => setDraft({ ...draft, fuelDollarsPerHour: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Total $/hr (bare + fuel)">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.totalDollarsPerHour}
                    onChange={(e) =>
                      setDraft({ ...draft, totalDollarsPerHour: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="Unit">
                <input
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="hr"
                  className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Vendor category">
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Excavators"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Daily $">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.dailyDollars}
                    onChange={(e) => setDraft({ ...draft, dailyDollars: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Weekly $">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.weeklyDollars}
                    onChange={(e) => setDraft({ ...draft, weeklyDollars: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Monthly $">
                  <input
                    type="number"
                    step="0.01"
                    value={draft.monthlyDollars}
                    onChange={(e) => setDraft({ ...draft, monthlyDollars: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="Source">
                <select
                  value={draft.source}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value as EquipmentRateSource })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field label="Notes">
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : draft.id ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
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

'use client';

// Labor rate book CRUD UI.
//
// Two sections: a "New rate" form on top, then the active rate table
// with inline-editable money fields and a delete (soft) button. The
// row is "dirty" while the operator types; clicking Save POSTs the
// patch and refreshes from the server.
//
// Cents are entered as dollars in the input (e.g. "65.50") and
// converted at the wire — keeps the operator in their normal unit
// while preserving the cents-on-the-wire invariant from CLAUDE.md.

import { useEffect, useState } from 'react';
import type {
  LaborRate,
  LaborRateCreate,
  LaborRatePatch,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function dollarsToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToDollarsInput(c: number | null | undefined): string {
  if (c == null) return '';
  return (c / 100).toFixed(2);
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs';
const moneyInputClass = 'w-24 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono';
const tinyInputClass = 'w-16 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono';

interface NewRateForm {
  code: string;
  classification: string;
  area: string;
  burdenPct: string;
  baseDollarsPrivate: string;
  baseDollarsPW: string;
  baseDollarsDB: string;
  baseDollarsIBEW: string;
  effectiveFrom: string;
  source: string;
}

const EMPTY_FORM: NewRateForm = {
  code: '',
  classification: '',
  area: '',
  burdenPct: '45',
  baseDollarsPrivate: '',
  baseDollarsPW: '',
  baseDollarsDB: '',
  baseDollarsIBEW: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  source: '',
};

export function LaborRateManager() {
  const [rates, setRates] = useState<LaborRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewRateForm>(EMPTY_FORM);
  // Per-row pending edits keyed by id.
  const [edits, setEdits] = useState<Record<string, Partial<LaborRate> & {
    _baseDollarsPrivate?: string;
    _baseDollarsPW?: string;
    _baseDollarsDB?: string;
    _baseDollarsIBEW?: string;
    _burdenPctDisplay?: string;
  }>>({});

  async function reload(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/labor-rates`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`API ${res.status}`);
        setRates([]);
        return;
      }
      const data = (await res.json()) as { laborRates?: LaborRate[] };
      setRates(data.laborRates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRates([]);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function addRate(): Promise<void> {
    setError(null);
    if (!form.code || !form.classification) {
      setError('Code and classification are required.');
      return;
    }
    const burden = Number.parseFloat(form.burdenPct);
    if (!Number.isFinite(burden) || burden < 0 || burden > 200) {
      setError('Burden % must be 0–200.');
      return;
    }
    const payload: LaborRateCreate = {
      code: form.code.trim(),
      classification: form.classification.trim(),
      area: form.area ? Number.parseInt(form.area, 10) : null,
      burdenPct: burden / 100,
      baseCentsPrivate: dollarsToCents(form.baseDollarsPrivate),
      baseCentsPW: dollarsToCents(form.baseDollarsPW),
      baseCentsDB: dollarsToCents(form.baseDollarsDB),
      baseCentsIBEW: form.baseDollarsIBEW ? dollarsToCents(form.baseDollarsIBEW) : null,
      effectiveFrom: form.effectiveFrom,
      source: form.source.trim() || null,
    };
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/labor-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Add failed (${res.status}).`);
        return;
      }
      setForm(EMPTY_FORM);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(id: string): Promise<void> {
    const pending = edits[id];
    if (!pending) return;
    const patch: LaborRatePatch = {};
    if (pending.classification !== undefined) patch.classification = pending.classification;
    if (pending._burdenPctDisplay !== undefined) {
      const n = Number.parseFloat(pending._burdenPctDisplay);
      if (Number.isFinite(n)) patch.burdenPct = n / 100;
    }
    if (pending._baseDollarsPrivate !== undefined) patch.baseCentsPrivate = dollarsToCents(pending._baseDollarsPrivate);
    if (pending._baseDollarsPW !== undefined) patch.baseCentsPW = dollarsToCents(pending._baseDollarsPW);
    if (pending._baseDollarsDB !== undefined) patch.baseCentsDB = dollarsToCents(pending._baseDollarsDB);
    if (pending._baseDollarsIBEW !== undefined) {
      patch.baseCentsIBEW = pending._baseDollarsIBEW ? dollarsToCents(pending._baseDollarsIBEW) : null;
    }
    if (pending.effectiveFrom !== undefined) patch.effectiveFrom = pending.effectiveFrom;
    if (pending.effectiveTo !== undefined) patch.effectiveTo = pending.effectiveTo;
    if (pending.source !== undefined) patch.source = pending.source;
    if (pending.area !== undefined) patch.area = pending.area;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/labor-rates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status}).`);
        return;
      }
      setEdits((e) => {
        const { [id]: _drop, ...rest } = e;
        return rest;
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(id: string): Promise<void> {
    if (!confirm('Soft-delete this rate? It stays in audit history.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/labor-rates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status}).`);
        return;
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function setEditField(id: string, key: string, value: unknown): void {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Add a rate</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Code (cost code)">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputClass}
              placeholder="LAB-OE-EXC4"
            />
          </Field>
          <Field label="Classification">
            <input
              type="text"
              value={form.classification}
              onChange={(e) => setForm({ ...form, classification: e.target.value })}
              className={inputClass}
              placeholder="Operator Group 4 — Excavator/Dozer"
            />
          </Field>
          <Field label="DIR area #">
            <input
              type="text"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className={inputClass}
              placeholder="1"
            />
          </Field>
          <Field label="Burden %">
            <input
              type="text"
              inputMode="decimal"
              value={form.burdenPct}
              onChange={(e) => setForm({ ...form, burdenPct: e.target.value })}
              className={inputClass}
              placeholder="45"
            />
          </Field>
          <Field label="Effective from">
            <input
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Source (provenance)">
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className={inputClass}
              placeholder="CA DIR 2026-01 General Determination"
            />
          </Field>
          <Field label="Private $/hr">
            <input
              type="text"
              inputMode="decimal"
              value={form.baseDollarsPrivate}
              onChange={(e) => setForm({ ...form, baseDollarsPrivate: e.target.value })}
              className={inputClass}
              placeholder="65.50"
            />
          </Field>
          <Field label="PW $/hr (CA DIR)">
            <input
              type="text"
              inputMode="decimal"
              value={form.baseDollarsPW}
              onChange={(e) => setForm({ ...form, baseDollarsPW: e.target.value })}
              className={inputClass}
              placeholder="78.40"
            />
          </Field>
          <Field label="Davis-Bacon $/hr">
            <input
              type="text"
              inputMode="decimal"
              value={form.baseDollarsDB}
              onChange={(e) => setForm({ ...form, baseDollarsDB: e.target.value })}
              className={inputClass}
              placeholder="76.20"
            />
          </Field>
          <Field label="IBEW $/hr (optional)">
            <input
              type="text"
              inputMode="decimal"
              value={form.baseDollarsIBEW}
              onChange={(e) => setForm({ ...form, baseDollarsIBEW: e.target.value })}
              className={inputClass}
              placeholder="(blank if N/A)"
            />
          </Field>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={addRate}
            disabled={busy}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add rate'}
          </button>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
          Active rate book {rates ? `(${rates.length})` : ''}
        </div>
        {!rates ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : rates.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No rates yet — add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Code</th>
                  <th className="px-2 py-2 text-left">Classification</th>
                  <th className="px-2 py-2 text-right">Area</th>
                  <th className="px-2 py-2 text-right">Burden %</th>
                  <th className="px-2 py-2 text-right">Private</th>
                  <th className="px-2 py-2 text-right">PW</th>
                  <th className="px-2 py-2 text-right">DB</th>
                  <th className="px-2 py-2 text-right">IBEW</th>
                  <th className="px-2 py-2 text-left">Effective</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rates.map((r) => {
                  const e = edits[r.id] ?? {};
                  const dirty = Object.keys(e).length > 0;
                  return (
                    <tr key={r.id} className={dirty ? 'bg-amber-50' : ''}>
                      <td className="px-2 py-1.5 font-mono text-xs">{r.code}</td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          defaultValue={r.classification}
                          onChange={(ev) => setEditField(r.id, 'classification', ev.target.value)}
                          className={inputClass + ' min-w-[200px]'}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          defaultValue={r.area ?? ''}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setEditField(r.id, 'area', v ? Number.parseInt(v, 10) : null);
                          }}
                          className={tinyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={(r.burdenPct * 100).toFixed(2)}
                          onChange={(ev) => setEditField(r.id, '_burdenPctDisplay', ev.target.value)}
                          className={tinyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={centsToDollarsInput(r.baseCentsPrivate)}
                          onChange={(ev) => setEditField(r.id, '_baseDollarsPrivate', ev.target.value)}
                          className={moneyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={centsToDollarsInput(r.baseCentsPW)}
                          onChange={(ev) => setEditField(r.id, '_baseDollarsPW', ev.target.value)}
                          className={moneyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={centsToDollarsInput(r.baseCentsDB)}
                          onChange={(ev) => setEditField(r.id, '_baseDollarsDB', ev.target.value)}
                          className={moneyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={centsToDollarsInput(r.baseCentsIBEW ?? null)}
                          onChange={(ev) => setEditField(r.id, '_baseDollarsIBEW', ev.target.value)}
                          className={moneyInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-gray-600">{r.effectiveFrom}</td>
                      <td className="px-2 py-1.5 text-right">
                        {dirty && (
                          <button
                            type="button"
                            onClick={() => saveRow(r.id)}
                            disabled={busy}
                            className="mr-2 rounded bg-yge-blue-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteRow(r.id)}
                          disabled={busy}
                          className="rounded border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
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
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

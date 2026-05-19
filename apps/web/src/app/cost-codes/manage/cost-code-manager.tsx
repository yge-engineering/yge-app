'use client';

// Cost-code master CRUD UI.
//
// Mirrors the labor-rate manager pattern: "Add cost code" form at
// the top, then an inline-editable table. Plain English: type a
// new code in, save it, then anyone making an estimate sees it in
// the picker.

import { useEffect, useState } from 'react';
import type {
  CostCode,
  CostCodeCreate,
  CostCodePatch,
  CostCodeRateSource,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const RATE_SOURCES: CostCodeRateSource[] = [
  'Labor_Rates',
  'Equipment_Rates',
  'Equipment_Rental',
  'Materials',
  'Subcontractors',
  'Other',
];

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs';
const selectClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs bg-white';

interface NewForm {
  code: string;
  category: string;
  description: string;
  rateSource: CostCodeRateSource;
}
const EMPTY: NewForm = { code: '', category: '', description: '', rateSource: 'Other' };

export function CostCodeManager() {
  const [rows, setRows] = useState<CostCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewForm>(EMPTY);
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, Partial<CostCode>>>({});

  async function reload(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`API ${res.status}`);
        setRows([]);
        return;
      }
      const data = (await res.json()) as { costCodes?: CostCode[] };
      setRows(data.costCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    }
  }
  useEffect(() => { void reload(); }, []);

  async function add(): Promise<void> {
    setError(null);
    if (!form.code.trim()) { setError('Code is required.'); return; }
    const payload: CostCodeCreate = {
      code: form.code.trim().toUpperCase(),
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      rateSource: form.rateSource,
    };
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/cost-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const patch: CostCodePatch = {};
    if (pending.code !== undefined) patch.code = pending.code;
    if (pending.category !== undefined) patch.category = pending.category;
    if (pending.description !== undefined) patch.description = pending.description;
    if (pending.rateSource !== undefined) patch.rateSource = pending.rateSource;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/cost-codes/${id}`, {
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
    if (!confirm('Delete this cost code? Make sure nothing on disk still references it.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/cost-codes/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(`Delete failed (${res.status}).`); return; }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  function setEdit(id: string, key: keyof CostCode, value: unknown): void {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  const visible = rows
    ? rows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          (r.category ?? '').toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q)
        );
      })
    : null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}
      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Add a cost code</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Code</span>
            <input type="text" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputClass} placeholder="LAB-OE-EXC4" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Category</span>
            <input type="text" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass} placeholder="Labor / Operators" />
          </label>
          <label className="block text-xs sm:col-span-2">
            <span className="mb-1 block font-medium text-gray-700">Description</span>
            <input type="text" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass} placeholder="Operator Group 4 — Excavator/Dozer" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Rate source</span>
            <select className={selectClass} value={form.rateSource}
              onChange={(e) => setForm({ ...form, rateSource: e.target.value as CostCodeRateSource })}>
              {RATE_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <button type="button" onClick={add} disabled={busy}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Add cost code'}
          </button>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <div className="text-sm font-semibold text-gray-800">
            Cost codes {visible ? `(${visible.length}${rows && rows.length !== visible.length ? ` / ${rows.length}` : ''})` : ''}
          </div>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="filter…" className="rounded border border-gray-300 px-2 py-1 text-xs" />
        </div>
        {!visible ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No codes match. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Code</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">Rate source</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => {
                  const e = edits[r.id] ?? {};
                  const dirty = Object.keys(e).length > 0;
                  return (
                    <tr key={r.id} className={dirty ? 'bg-amber-50' : ''}>
                      <td className="px-2 py-1.5">
                        <input type="text" defaultValue={r.code}
                          onChange={(ev) => setEdit(r.id, 'code', ev.target.value.toUpperCase())}
                          className={inputClass + ' font-mono'} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" defaultValue={r.category ?? ''}
                          onChange={(ev) => setEdit(r.id, 'category', ev.target.value)}
                          className={inputClass} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" defaultValue={r.description ?? ''}
                          onChange={(ev) => setEdit(r.id, 'description', ev.target.value)}
                          className={inputClass} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={selectClass} defaultValue={r.rateSource}
                          onChange={(ev) => setEdit(r.id, 'rateSource', ev.target.value as CostCodeRateSource)}>
                          {RATE_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
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

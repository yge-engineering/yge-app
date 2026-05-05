'use client';

// Cost codes browser — searchable + add/edit/delete.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CostCode, CostCodeRateSource } from '@yge/shared';

const RATE_SOURCES: CostCodeRateSource[] = [
  'Labor_Rates',
  'Equipment_Rates',
  'Equipment_Rental',
  'Materials',
  'Subcontractors',
  'Other',
];

interface DraftCostCode {
  id?: string;
  code: string;
  category: string;
  description: string;
  rateSource: CostCodeRateSource;
}

const blankDraft: DraftCostCode = {
  code: '',
  category: '',
  description: '',
  rateSource: 'Other',
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function CostCodesTable({ codes }: { codes: CostCode[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [editing, setEditing] = useState<DraftCostCode | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of codes) if (c.category) set.add(c.category);
    return Array.from(set).sort();
  }, [codes]);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return codes.filter((c) => {
      if (category && c.category !== category) return false;
      if (!norm) return true;
      return (
        c.code.toLowerCase().includes(norm) ||
        (c.description ?? '').toLowerCase().includes(norm) ||
        (c.category ?? '').toLowerCase().includes(norm)
      );
    });
  }, [codes, q, category]);

  function startNew() {
    setEditing({ ...blankDraft });
  }
  function startEdit(c: CostCode) {
    setEditing({
      id: c.id,
      code: c.code,
      category: c.category ?? '',
      description: c.description ?? '',
      rateSource: c.rateSource,
    });
  }

  async function save(draft: DraftCostCode) {
    const body = {
      code: draft.code.trim(),
      rateSource: draft.rateSource,
      ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    };
    const url = draft.id
      ? `${API_BASE_URL}/api/cost-codes/${draft.id}`
      : `${API_BASE_URL}/api/cost-codes`;
    const res = await fetch(url, {
      method: draft.id ? 'PATCH' : 'POST',
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

  async function remove(c: CostCode) {
    if (!confirm(`Delete cost code "${c.code}"? This cannot be undone.`)) return;
    const res = await fetch(`${API_BASE_URL}/api/cost-codes/${c.id}`, {
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by code, description, or category…"
            className="w-72 max-w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {filtered.length} of {codes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + New cost code
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">
                  No cost codes match.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="group hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{c.category ?? '—'}</td>
                  <td className="px-3 py-2">{c.description ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.rateSource}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs text-gray-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                    >
                      Edit
                    </button>
                    <span className="px-1 text-gray-300 opacity-0 group-hover:opacity-100">·</span>
                    <button
                      type="button"
                      onClick={() => remove(c)}
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
        <CostCodeModal
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function CostCodeModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: DraftCostCode;
  onCancel: () => void;
  onSave: (draft: DraftCostCode) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!draft.code.trim()) {
      setError('Code is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...draft, code: draft.code.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {draft.id ? 'Edit cost code' : 'New cost code'}
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
          <Field label="Code">
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              placeholder="e.g. EQP-EX-MINI"
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
              autoFocus
            />
          </Field>

          <Field label="Category">
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="e.g. Labor / Laborers"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Rate source">
            <select
              value={draft.rateSource}
              onChange={(e) =>
                setDraft({ ...draft, rateSource: e.target.value as CostCodeRateSource })
              }
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {RATE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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

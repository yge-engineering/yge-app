'use client';

// Cost codes browser — searchable table.

import { useMemo, useState } from 'react';
import type { CostCode } from '@yge/shared';

export function CostCodesTable({ codes }: { codes: CostCode[] }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');

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

  return (
    <div className="space-y-3">
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                  No cost codes match.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{c.category ?? '—'}</td>
                  <td className="px-3 py-2">{c.description ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.rateSource}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
